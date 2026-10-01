import type { Alerts, Prisma, Product } from '../generated/prisma/client.ts';
import { StatusAlert, TypeAlert } from '../generated/prisma/enums.ts';

type StockSnapshot = Pick<Product, 'id' | 'organization_id' | 'nombre' | 'codigo_sku' | 'stock_actual' | 'stock_minimo'>;

// What syncLowStockAlert changed, so the caller can notify it once the transaction commits
export type LowStockAlertChange = { type: 'created' | 'resolved'; alert: Alerts } | null;

export const isLowStock = ({ stock_actual, stock_minimo }: Pick<Product, 'stock_actual' | 'stock_minimo'>) =>
  stock_actual <= stock_minimo;

// Keeps at most one ACTIVA STOCK_BAJO alert per product: opens it when the stock
// reaches the minimum and resolves it once the stock is above it again.
// Plain function (no Nest DI) so the Prisma seed can reuse it. `tx` must be scoped to the
// product's organization (PrismaService.withTenant / setTenant)
export async function syncLowStockAlert(
  tx: Prisma.TransactionClient,
  product: StockSnapshot,
): Promise<LowStockAlertChange> {
  const activeAlert = await tx.alerts.findFirst({
    where: { product_id: product.id, tipo: TypeAlert.STOCK_BAJO, estado: StatusAlert.ACTIVA },
    select: { id: true },
  });

  if (isLowStock(product)) {
    if (activeAlert) return null;
    const alert = await tx.alerts.create({
      data: {
        organization_id: product.organization_id,
        product_id: product.id,
        tipo: TypeAlert.STOCK_BAJO,
        estado: StatusAlert.ACTIVA,
        descripcion: `Stock bajo: ${product.nombre} (${product.codigo_sku}) tiene ${product.stock_actual} unidades, mínimo ${product.stock_minimo}`,
      },
    });
    return { type: 'created', alert };
  }

  if (!activeAlert) return null;
  const alert = await tx.alerts.update({
    where: { id: activeAlert.id },
    data: { estado: StatusAlert.RESUELTA },
  });
  return { type: 'resolved', alert };
}
