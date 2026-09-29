import { Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { FindProductsDto } from './dto/find-products.dto.ts';
import { AdjustStockDto } from './dto/adjust-stock.dto.ts';
import { PrismaService } from '../prisma/prisma-service.service.ts';
import { syncLowStockAlert } from '../alerts/low-stock-alert.ts';
import type { Prisma, Product } from '../generated/prisma/client.ts';
import { TypeProductHistory } from '../generated/prisma/enums.ts';
import type { PurchaseOrderReceivedEvent } from '../common/index.ts';

// Motivo of the entrada recorded when a purchase order is received. It doubles as
// the idempotency key: a redelivered purchase-order.received adds no stock twice
export const purchaseOrderReceivedMotivo = (purchaseOrderId: string) =>
  `Orden de compra ${purchaseOrderId} recibida`;

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(private prisma: PrismaService) { }

  async create(createProductDto: CreateProductDto) {
    const product = await this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({ data: createProductDto });
      await syncLowStockAlert(tx, product);
      return product;
    });
    return this.toProductResponse(product);
  }

  async findAll(findProductsDto: FindProductsDto) {
    const { page, limit, categoria, proveedor, nombre, activo, stock_bajo } = findProductsDto;

    const where: Prisma.ProductWhereInput = {
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

    const total = await this.prisma.product.count({ where });

    const products = await this.prisma.product.findMany({
      where,
      take: limit,
      skip: (page! - 1) * limit!,
      orderBy: { id: 'asc' },
    });

    return {
      data: products.map((product) => this.toProductResponse(product)),
      meta: {
        total,
        page,
        lastPage: Math.ceil(total / limit!),
      },
    };
  }

  async findOne(id: number) {
    return this.toProductResponse(await this.findActive(id));
  }

  async update(id: number, updateProductDto: Omit<UpdateProductDto, 'id'>) {
    await this.findActive(id);

    const product = await this.prisma.$transaction(async (tx) => {
      const product = await tx.product.update({
        where: { id },
        data: updateProductDto,
      });
      // stock_minimo may have changed
      await syncLowStockAlert(tx, product);
      return product;
    });
    return this.toProductResponse(product);
  }

  async remove(id: number) {
    await this.findActive(id);

    const product = await this.prisma.product.update({
      where: { id },
      data: { activo: false },
    });
    return this.toProductResponse(product);
  }

  // Records the movement in the history and keeps the STOCK_BAJO alert in sync
  async adjustStock({ id, tipo, cantidad, motivo }: AdjustStockDto) {
    const product = await this.prisma.$transaction(async (tx) => {
      const current = await this.findActive(id, tx);

      if (tipo === TypeProductHistory.salida) {
        // Conditional update: never lets the stock go negative, even concurrently
        const { count } = await tx.product.updateMany({
          where: { id, stock_actual: { gte: cantidad } },
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
          where: { id },
          data: { stock_actual: { increment: cantidad } },
        });
      }

      await tx.productHistory.create({ data: { product_id: id, tipo, cantidad, motivo } });

      const product = await tx.product.findUniqueOrThrow({ where: { id } });
      await syncLowStockAlert(tx, product);
      return product;
    });

    return this.toProductResponse(product);
  }

  // Purchase order saga: the product must exist and be active to be ordered
  async validateProduct(id: number) {
    const product = await this.prisma.product.findUnique({ where: { id } });

    if (!product || !product.activo) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: `Product #${id} not found or inactive`,
      });
    }

    return product;
  }

  // Purchase order saga: the goods arrived, so the stock goes up even if the
  // product was deactivated meanwhile. Returns false for a duplicate delivery
  async receivePurchaseOrder({ purchaseOrderId, producto_id, cantidad }: PurchaseOrderReceivedEvent) {
    const motivo = purchaseOrderReceivedMotivo(purchaseOrderId);

    return this.prisma.$transaction(async (tx) => {
      const alreadyApplied = await tx.productHistory.findFirst({
        where: { product_id: producto_id, motivo },
        select: { id: true },
      });
      if (alreadyApplied) {
        this.logger.warn(`Purchase order #${purchaseOrderId} was already added to the stock`);
        return false;
      }

      const product = await tx.product.update({
        where: { id: producto_id },
        data: { stock_actual: { increment: cantidad } },
      });
      await tx.productHistory.create({
        data: { product_id: producto_id, tipo: TypeProductHistory.entrada, cantidad, motivo },
      });
      await syncLowStockAlert(tx, product);

      this.logger.log(`Purchase order #${purchaseOrderId}: +${cantidad} to product #${producto_id}`);
      return true;
    });
  }

  private async findActive(id: number, tx: Prisma.TransactionClient = this.prisma) {
    const product = await tx.product.findUnique({ where: { id, activo: true } });

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
