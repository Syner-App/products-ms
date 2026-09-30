import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.ts';
import { syncLowStockAlert } from '../src/alerts/low-stock-alert.ts';
import { isOrganizationId, setTenant } from '../src/prisma/tenant.ts';
import { seedProductsData } from './seed-data.ts';

// Demo catalog for one organization (new organizations start empty). Run it by hand:
// SEED_ORGANIZATION_ID=<auth-ms organization id> pnpm prisma db seed
const organization_id = process.env['SEED_ORGANIZATION_ID'];
if (!isOrganizationId(organization_id)) {
  throw new Error('SEED_ORGANIZATION_ID must be the id of an auth-ms organization');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
});

// Idempotent: existing SKUs of the organization are left untouched
async function main() {
  for (const data of seedProductsData) {
    await prisma.$transaction(async (tx) => {
      await setTenant(tx, organization_id!);
      const product = await tx.product.upsert({
        where: { organization_id_codigo_sku: { organization_id: organization_id!, codigo_sku: data.codigo_sku } },
        create: { ...data, organization_id: organization_id! },
        update: {},
      });
      await syncLowStockAlert(tx, product);
    });
  }
  console.log(`Seed: ${seedProductsData.length} productos cargados en la organización ${organization_id}`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
