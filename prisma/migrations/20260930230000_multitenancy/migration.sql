-- Multitenancy: every row belongs to an organization (auth-ms). The tables are empty when
-- this runs (the stack starts from clean volumes), so the NOT NULL columns need no backfill

-- DropIndex
DROP INDEX "productos_codigo_sku_key";

-- DropIndex
DROP INDEX "productos_categoria_idx";

-- DropIndex
DROP INDEX "productos_activo_idx";

-- DropIndex
DROP INDEX "alertas_estado_createdAt_idx";

-- AlterTable
ALTER TABLE "productos" ADD COLUMN     "organization_id" VARCHAR(24) NOT NULL;

-- AlterTable
ALTER TABLE "historial_productos" ADD COLUMN     "organization_id" VARCHAR(24) NOT NULL;

-- AlterTable
ALTER TABLE "alertas" ADD COLUMN     "organization_id" VARCHAR(24) NOT NULL;

-- CreateIndex
CREATE INDEX "productos_organization_id_categoria_idx" ON "productos"("organization_id", "categoria");

-- CreateIndex
CREATE INDEX "productos_organization_id_activo_idx" ON "productos"("organization_id", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "productos_organization_id_codigo_sku_key" ON "productos"("organization_id", "codigo_sku");

-- CreateIndex
CREATE INDEX "alertas_organization_id_estado_createdAt_idx" ON "alertas"("organization_id", "estado", "createdAt");


-- Row Level Security: the second barrier behind the organization_id filters in the services.
-- PrismaService.withTenant() runs every query inside a transaction that sets
-- app.organization_id; without it (or for another organization) no row is visible or
-- writable. FORCE applies the policy to the table owner too; superusers still bypass it,
-- so the services connect with a dedicated role (postgres-init/app-role.sh in the syner root)
ALTER TABLE "productos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "productos" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "productos"
    USING ("organization_id" = current_setting('app.organization_id', true))
    WITH CHECK ("organization_id" = current_setting('app.organization_id', true));

ALTER TABLE "historial_productos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "historial_productos" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "historial_productos"
    USING ("organization_id" = current_setting('app.organization_id', true))
    WITH CHECK ("organization_id" = current_setting('app.organization_id', true));

ALTER TABLE "alertas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "alertas" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "alertas"
    USING ("organization_id" = current_setting('app.organization_id', true))
    WITH CHECK ("organization_id" = current_setting('app.organization_id', true));
