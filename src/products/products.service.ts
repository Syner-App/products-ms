import { Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { FindProductsDto } from './dto/find-products.dto.ts';
import { AdjustStockDto } from './dto/adjust-stock.dto.ts';
import { PrismaService } from '../prisma/prisma-service.service.ts';
import { AlertsClient } from '../alerts/alerts.client.ts';
import type { Prisma, Product } from '../generated/prisma/client.ts';
import { TypeProductHistory } from '../generated/prisma/enums.ts';
import type { PurchaseOrderReceivedEvent } from '../common/index.ts';

// The STOCK_BAJO alert is synced over RabbitMQ (AlertsClient) after each commit, never
// inside the transaction: the consumer uses its own connection and would not see
// uncommitted rows. A failed sync propagates the error, but the stock change stays

// Motivo of the entrada recorded when a purchase order is received. It doubles as
// the idempotency key: a redelivered purchase-order.received adds no stock twice
export const purchaseOrderReceivedMotivo = (purchaseOrderId: string) =>
  `Orden de compra ${purchaseOrderId} recibida`;

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private prisma: PrismaService,
    private readonly alertsClient: AlertsClient,
  ) { }

  async create(createProductDto: CreateProductDto) {
    const { organization_id } = createProductDto;
    const product = await this.prisma.withTenant(organization_id, (tx) =>
      tx.product.create({ data: createProductDto }),
    );
    await this.alertsClient.syncLowStock(organization_id, product.id);
    return this.toProductResponse(product);
  }

  async findAll(findProductsDto: FindProductsDto) {
    const { organization_id, page, limit, categoria, proveedor, nombre, activo, stock_bajo } = findProductsDto;

    const where: Prisma.ProductWhereInput = {
      organization_id,
      activo: activo ?? true,
      categoria,
      proveedor: proveedor ? { contains: proveedor, mode: 'insensitive' } : undefined,
      nombre: nombre ? { contains: nombre, mode: 'insensitive' } : undefined,
      // Column comparison: stock_actual <= stock_minimo (or > when stock_bajo=false)
      stock_actual: stock_bajo === undefined
        ? undefined
        : stock_bajo
          ? { lte: this.prisma.product.fields.stock_minimo }
          : { gt: this.prisma.product.fields.stock_minimo },
    };

    const [total, products] = await this.prisma.withTenant(organization_id, async (tx) => [
      await tx.product.count({ where }),
      await tx.product.findMany({
        where,
        take: limit,
        skip: (page! - 1) * limit!,
        orderBy: { id: 'asc' },
      }),
    ] as const);

    return {
      data: products.map((product) => this.toProductResponse(product)),
      meta: {
        total,
        page,
        lastPage: Math.ceil(total / limit!),
      },
    };
  }

  async findOne(organization_id: string, id: number) {
    const product = await this.prisma.withTenant(organization_id, (tx) => this.findActive(tx, organization_id, id));
    return this.toProductResponse(product);
  }

  async update(organization_id: string, id: number, updateProductDto: Omit<UpdateProductDto, 'id' | 'organization_id'>) {
    const product = await this.prisma.withTenant(organization_id, async (tx) => {
      await this.findActive(tx, organization_id, id);
      return tx.product.update({
        where: { id, organization_id },
        data: updateProductDto,
      });
    });
    // stock_minimo may have changed
    await this.alertsClient.syncLowStock(organization_id, product.id);
    return this.toProductResponse(product);
  }

  async remove(organization_id: string, id: number) {
    const product = await this.prisma.withTenant(organization_id, async (tx) => {
      await this.findActive(tx, organization_id, id);
      return tx.product.update({
        where: { id, organization_id },
        data: { activo: false },
      });
    });
    return this.toProductResponse(product);
  }

  // Records the movement in the history and keeps the STOCK_BAJO alert in sync
  async adjustStock({ organization_id, id, tipo, cantidad, motivo }: AdjustStockDto) {
    const product = await this.prisma.withTenant(organization_id, async (tx) => {
      const current = await this.findActive(tx, organization_id, id);

      if (tipo === TypeProductHistory.salida) {
        // Conditional update: never lets the stock go negative, even concurrently
        const { count } = await tx.product.updateMany({
          where: { id, organization_id, stock_actual: { gte: cantidad } },
          data: { stock_actual: { decrement: cantidad } },
        });
        if (count === 0) {
          throw new RpcException({
            code: status.FAILED_PRECONDITION,
            message: `Insufficient stock for product #${id}: ${current.stock_actual} available, ${cantidad} requested`,
          });
        }
      } else {
        await tx.product.update({
          where: { id, organization_id },
          data: { stock_actual: { increment: cantidad } },
        });
      }

      await tx.productHistory.create({ data: { organization_id, product_id: id, tipo, cantidad, motivo } });

      return tx.product.findUniqueOrThrow({ where: { id, organization_id } });
    });

    await this.alertsClient.syncLowStock(organization_id, id);
    return this.toProductResponse(product);
  }

  // Purchase order saga: the product must exist, be active and belong to the organization
  // of the purchase order to be ordered
  async validateProduct(organization_id: string, id: number) {
    const product = await this.prisma.withTenant(organization_id, (tx) =>
      tx.product.findUnique({ where: { id, organization_id } }),
    );

    if (!product || !product.activo) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: `Product #${id} not found or inactive`,
      });
    }

    return product;
  }

  // Purchase order saga: the goods arrived, so the stock goes up even if the
  // product was deactivated meanwhile. Returns false for a duplicate delivery; the
  // alert is synced either way, so a redelivery after a failed sync repairs it
  async receivePurchaseOrder({ organization_id, purchaseOrderId, producto_id, cantidad }: PurchaseOrderReceivedEvent) {
    const motivo = purchaseOrderReceivedMotivo(purchaseOrderId);

    const applied = await this.prisma.withTenant(organization_id, async (tx) => {
      const alreadyApplied = await tx.productHistory.findFirst({
        where: { organization_id, product_id: producto_id, motivo },
        select: { id: true },
      });
      if (alreadyApplied) {
        this.logger.warn(`Purchase order #${purchaseOrderId} was already added to the stock`);
        return false;
      }

      await tx.product.update({
        where: { id: producto_id, organization_id },
        data: { stock_actual: { increment: cantidad } },
      });
      await tx.productHistory.create({
        data: { organization_id, product_id: producto_id, tipo: TypeProductHistory.entrada, cantidad, motivo },
      });

      this.logger.log(`Purchase order #${purchaseOrderId}: +${cantidad} to product #${producto_id}`);
      return true;
    });

    await this.alertsClient.syncLowStock(organization_id, producto_id);
    return applied;
  }

  // A product of another organization is NOT_FOUND, like a missing one
  private async findActive(tx: Prisma.TransactionClient, organization_id: string, id: number) {
    const product = await tx.product.findUnique({ where: { id, organization_id, activo: true } });

    if (!product) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: `Product with id: #${id} not found`,
      });
    }

    return product;
  }

  // proto-loader cannot serialize Date objects, so dates travel as ISO-8601 strings
  private toProductResponse(product: Product) {
    return {
      ...product,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt?.toISOString(),
    };
  }
}
