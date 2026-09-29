import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.ts';
import { syncLowStockAlert } from '../src/alerts/low-stock-alert.ts';
import { seedProductsData } from './seed-data.ts';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
});

// Idempotent initial load: existing SKUs are left untouched, so it runs on every start
async function main() {
  for (const data of seedProductsData) {
    await prisma.$transaction(async (tx) => {
      const product = await tx.product.upsert({
        where: { codigo_sku: data.codigo_sku },
        create: data,
        update: {},
      });
      await syncLowStockAlert(tx, product);
    });
  }
  console.log(`Seed: ${seedProductsData.length} productos cargados`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
