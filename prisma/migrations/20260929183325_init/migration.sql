-- CreateEnum
CREATE TYPE "TypeCategory" AS ENUM ('Bebidas', 'Lacteos', 'Snacks', 'Limpieza', 'Frutas', 'Granos');

-- CreateEnum
CREATE TYPE "TypeProductHistory" AS ENUM ('entrada', 'salida');

-- CreateEnum
CREATE TYPE "TypeAlert" AS ENUM ('STOCK_BAJO');

-- CreateEnum
CREATE TYPE "StatusAlert" AS ENUM ('ACTIVA', 'RESUELTA');

-- CreateTable
CREATE TABLE "productos" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR NOT NULL,
    "codigo_sku" VARCHAR(20) NOT NULL,
    "categoria" "TypeCategory" NOT NULL,
    "precio" INTEGER NOT NULL,
    "stock_actual" INTEGER NOT NULL DEFAULT 0,
    "stock_minimo" INTEGER NOT NULL DEFAULT 0,
    "proveedor" VARCHAR NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP,

    CONSTRAINT "productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historial_productos" (
    "id" TEXT NOT NULL,
    "tipo" "TypeProductHistory" NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "fecha" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "motivo" VARCHAR NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "product_id" INTEGER NOT NULL,

    CONSTRAINT "historial_productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alertas" (
    "id" TEXT NOT NULL,
    "tipo" "TypeAlert" NOT NULL,
    "estado" "StatusAlert" NOT NULL,
    "descripcion" VARCHAR NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP,
    "product_id" INTEGER NOT NULL,

    CONSTRAINT "alertas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "productos_codigo_sku_key" ON "productos"("codigo_sku");

-- CreateIndex
CREATE INDEX "productos_categoria_idx" ON "productos"("categoria");

-- CreateIndex
CREATE INDEX "productos_activo_idx" ON "productos"("activo");

-- CreateIndex
CREATE INDEX "historial_productos_product_id_motivo_idx" ON "historial_productos"("product_id", "motivo");

-- CreateIndex
CREATE INDEX "alertas_product_id_estado_idx" ON "alertas"("product_id", "estado");

-- CreateIndex
CREATE INDEX "alertas_estado_createdAt_idx" ON "alertas"("estado", "createdAt");

-- AddForeignKey
ALTER TABLE "historial_productos" ADD CONSTRAINT "historial_productos_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertas" ADD CONSTRAINT "alertas_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
