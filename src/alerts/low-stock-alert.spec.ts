import { syncLowStockAlert } from './low-stock-alert.ts';
import type { Prisma } from '../generated/prisma/client.ts';

const product = { id: 4, organization_id: '6abd26a42d059ac027376ca1', nombre: 'Yogur Natural 500g', codigo_sku: 'LAC-002', stock_actual: 15, stock_minimo: 25 };

describe('syncLowStockAlert', () => {
  const tx = {
    alerts: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  };
  const sync = (snapshot: typeof product) =>
    syncLowStockAlert(tx as unknown as Prisma.TransactionClient, snapshot);

  beforeEach(() => vi.resetAllMocks());

  it('opens a STOCK_BAJO alert when the stock reaches the minimum', async () => {
    tx.alerts.findFirst.mockResolvedValue(null);

    await sync({ ...product, stock_actual: 25 });

    expect(tx.alerts.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organization_id: '6abd26a42d059ac027376ca1',
        product_id: 4,
        tipo: 'STOCK_BAJO',
        estado: 'ACTIVA',
      }),
    });
  });

  it('does not duplicate an active alert', async () => {
    tx.alerts.findFirst.mockResolvedValue({ id: 'alert-1' });

    await sync(product);

    expect(tx.alerts.create).not.toHaveBeenCalled();
    expect(tx.alerts.updateMany).not.toHaveBeenCalled();
  });

  it('resolves the active alert once the stock is above the minimum', async () => {
    tx.alerts.findFirst.mockResolvedValue({ id: 'alert-1' });

    await sync({ ...product, stock_actual: 26 });

    expect(tx.alerts.updateMany).toHaveBeenCalledWith({
      where: { product_id: 4, tipo: 'STOCK_BAJO', estado: 'ACTIVA' },
      data: { estado: 'RESUELTA' },
    });
  });

  it('does nothing when the stock is fine and there is no alert', async () => {
    tx.alerts.findFirst.mockResolvedValue(null);

    await sync({ ...product, stock_actual: 100 });

    expect(tx.alerts.create).not.toHaveBeenCalled();
    expect(tx.alerts.updateMany).not.toHaveBeenCalled();
  });
});
