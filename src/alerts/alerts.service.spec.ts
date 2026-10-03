import { of, throwError } from 'rxjs';
import { AlertsService } from './alerts.service.ts';
import { syncLowStockAlert } from './low-stock-alert.ts';
import { AlertEvents } from '../common/index.ts';

vi.mock('./low-stock-alert.ts', () => ({ syncLowStockAlert: vi.fn() }));

const organization_id = '6abd26a42d059ac027376ca1';
const alert = {
  id: 'alert-1',
  organization_id,
  product_id: 4,
  tipo: 'STOCK_BAJO',
  estado: 'ACTIVA',
  descripcion: 'Stock bajo',
  createdAt: new Date('2026-10-01T10:00:00.000Z'),
  updatedAt: null,
};

describe('AlertsService.syncLowStock', () => {
  const tx = { product: { findUniqueOrThrow: vi.fn() } };
  const prisma = { withTenant: vi.fn((_org: string, fn: (t: typeof tx) => unknown) => fn(tx)) };
  const eventsClient = { emit: vi.fn() };
  const service = new AlertsService(prisma as never, eventsClient as never);
  const sync = vi.mocked(syncLowStockAlert);

  beforeEach(() => {
    vi.clearAllMocks();
    tx.product.findUniqueOrThrow.mockResolvedValue({ id: 4, organization_id, proveedor: 'Lácteos Andinos', stock_minimo: 25 });
    eventsClient.emit.mockReturnValue(of(undefined));
  });

  it('publishes alert.created with ISO dates and the product snapshot', async () => {
    sync.mockResolvedValue({ type: 'created', alert } as never);

    await service.syncLowStock(organization_id, 4);

    expect(eventsClient.emit).toHaveBeenCalledWith(AlertEvents.Created, {
      organization_id,
      alert: expect.objectContaining({ id: 'alert-1', createdAt: '2026-10-01T10:00:00.000Z', updatedAt: undefined }),
      product: { proveedor: 'Lácteos Andinos', stock_minimo: 25 },
    });
  });

  it('publishes alert.resolved', async () => {
    sync.mockResolvedValue({ type: 'resolved', alert: { ...alert, estado: 'RESUELTA' } } as never);

    await service.syncLowStock(organization_id, 4);

    expect(eventsClient.emit).toHaveBeenCalledWith(AlertEvents.Resolved, expect.objectContaining({ organization_id }));
  });

  it('publishes nothing when the alert did not change', async () => {
    sync.mockResolvedValue(null);

    await service.syncLowStock(organization_id, 4);

    expect(eventsClient.emit).not.toHaveBeenCalled();
  });

  it('does not fail the sync when the publish fails', async () => {
    sync.mockResolvedValue({ type: 'created', alert } as never);
    eventsClient.emit.mockReturnValue(throwError(() => new Error('broker down')));

    await expect(service.syncLowStock(organization_id, 4)).resolves.toBeUndefined();
  });
});
