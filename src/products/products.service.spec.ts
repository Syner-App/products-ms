import { Test, TestingModule } from '@nestjs/testing';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { ProductsService, purchaseOrderReceivedMotivo } from './products.service.js';
import { PrismaService } from '../prisma-service/prisma-service.service.ts';

const purchaseOrderId = '6f1c1c9e-2f5b-4c1a-9a47-6a2b1f3c8d10';

const yogur = {
  id: 4,
  nombre: 'Yogur Natural 500g',
  codigo_sku: 'LAC-002',
  categoria: 'Lacteos',
  precio: 2800,
  stock_actual: 15,
  stock_minimo: 25,
  proveedor: 'Lácteos del Valle',
  activo: true,
  createdAt: new Date('2026-09-29T00:00:00Z'),
  updatedAt: null,
};

describe('ProductsService', () => {
  let service: ProductsService;
  const prisma = {
    product: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      fields: { stock_minimo: 'stock_minimo_ref' },
    },
    productHistory: { create: vi.fn(), findFirst: vi.fn() },
    alerts: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    // Interactive transactions run the callback with the same mock
    $transaction: vi.fn((callback: (tx: unknown) => unknown) => callback(prisma)),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    prisma.alerts.findFirst.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  it('findOne throws a NOT_FOUND RpcException when the product does not exist', async () => {
    prisma.product.findUnique.mockResolvedValue(null);

    const error = await service.findOne(99).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(RpcException);
    expect((error as RpcException).getError()).toMatchObject({ code: status.NOT_FOUND });
  });

  it('findOne serializes dates as ISO strings', async () => {
    prisma.product.findUnique.mockResolvedValue(yogur);

    await expect(service.findOne(4)).resolves.toMatchObject({
      createdAt: '2026-09-29T00:00:00.000Z',
      updatedAt: undefined,
    });
  });

  it('findAll builds the filters, defaulting to active products', async () => {
    prisma.product.count.mockResolvedValue(1);
    prisma.product.findMany.mockResolvedValue([yogur]);

    const result = await service.findAll({
      page: 1,
      limit: 10,
      categoria: 'Lacteos',
      nombre: 'yog',
      stock_bajo: true,
    });

    const where = {
      activo: true,
      categoria: 'Lacteos',
      proveedor: undefined,
      nombre: { contains: 'yog', mode: 'insensitive' },
      stock_actual: { lte: 'stock_minimo_ref' },
    };
    expect(prisma.product.count).toHaveBeenCalledWith({ where });
    expect(prisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({ where, take: 10, skip: 0 }));
    expect(result.meta).toEqual({ total: 1, page: 1, lastPage: 1 });
  });

  describe('adjustStock', () => {
    it('rejects a salida larger than the stock with FAILED_PRECONDITION', async () => {
      prisma.product.findUnique.mockResolvedValue(yogur);
      prisma.product.updateMany.mockResolvedValue({ count: 0 });

      const error = await service
        .adjustStock({ id: 4, tipo: 'salida', cantidad: 20, motivo: 'Venta' })
        .catch((e: unknown) => e);

      expect((error as RpcException).getError()).toMatchObject({ code: status.FAILED_PRECONDITION });
      expect(prisma.productHistory.create).not.toHaveBeenCalled();
    });

    it('records a salida, its history and opens the low stock alert', async () => {
      prisma.product.findUnique.mockResolvedValue({ ...yogur, stock_actual: 40 });
      prisma.product.updateMany.mockResolvedValue({ count: 1 });
      prisma.product.findUniqueOrThrow.mockResolvedValue({ ...yogur, stock_actual: 20 });

      await service.adjustStock({ id: 4, tipo: 'salida', cantidad: 20, motivo: 'Venta' });

      expect(prisma.product.updateMany).toHaveBeenCalledWith({
        where: { id: 4, stock_actual: { gte: 20 } },
        data: { stock_actual: { decrement: 20 } },
      });
      expect(prisma.productHistory.create).toHaveBeenCalledWith({
        data: { product_id: 4, tipo: 'salida', cantidad: 20, motivo: 'Venta' },
      });
      expect(prisma.alerts.create).toHaveBeenCalled();
    });

    it('records an entrada and resolves the active alert', async () => {
      prisma.product.findUnique.mockResolvedValue(yogur);
      prisma.product.findUniqueOrThrow.mockResolvedValue({ ...yogur, stock_actual: 65 });
      prisma.alerts.findFirst.mockResolvedValue({ id: 'alert-1' });

      await service.adjustStock({ id: 4, tipo: 'entrada', cantidad: 50, motivo: 'Reposición' });

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 4 },
        data: { stock_actual: { increment: 50 } },
      });
      expect(prisma.alerts.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { estado: 'RESUELTA' } }),
      );
    });
  });

  describe('validateProduct', () => {
    it('returns an active product', async () => {
      prisma.product.findUnique.mockResolvedValue(yogur);

      await expect(service.validateProduct(4)).resolves.toBe(yogur);
    });

    it('throws INVALID_ARGUMENT for an inactive product', async () => {
      prisma.product.findUnique.mockResolvedValue({ ...yogur, activo: false });

      const error = await service.validateProduct(4).catch((e: unknown) => e);

      expect((error as RpcException).getError()).toEqual({
        code: status.INVALID_ARGUMENT,
        message: 'Product #4 not found or inactive',
      });
    });
  });

  describe('receivePurchaseOrder', () => {
    const event = { purchaseOrderId, producto_id: 4, cantidad: 30 };

    it('adds the stock with an entrada keyed by the purchase order', async () => {
      prisma.productHistory.findFirst.mockResolvedValue(null);
      prisma.product.update.mockResolvedValue({ ...yogur, stock_actual: 45 });

      await expect(service.receivePurchaseOrder(event)).resolves.toBe(true);

      expect(prisma.productHistory.create).toHaveBeenCalledWith({
        data: {
          product_id: 4,
          tipo: 'entrada',
          cantidad: 30,
          motivo: purchaseOrderReceivedMotivo(purchaseOrderId),
        },
      });
    });

    it('ignores a duplicate delivery without adding the stock twice', async () => {
      prisma.productHistory.findFirst.mockResolvedValue({ id: 'history-1' });

      await expect(service.receivePurchaseOrder(event)).resolves.toBe(false);

      expect(prisma.product.update).not.toHaveBeenCalled();
      expect(prisma.productHistory.create).not.toHaveBeenCalled();
    });
  });
});
