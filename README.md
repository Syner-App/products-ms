<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

<h1 align="center">products-ms</h1>

<p align="center">Microservicio de productos del proyecto <strong>Syner</strong>, construido con NestJS, gRPC y RabbitMQ.</p>

## Descripción

`products-ms` es el microservicio de inventario de Syner: productos, historial de movimientos de stock y alertas de stock bajo. Expone su API mediante **gRPC** (sin servidor HTTP), persiste los datos con **Prisma** sobre **PostgreSQL** (`products-db`) y participa en la **saga de órdenes de compra** por **RabbitMQ**.

El contrato del servicio está definido en [`src/proto/products.proto`](src/proto/products.proto) (`products.ProductsService`). Los campos viajan en snake_case, igual que las columnas de Prisma:

| RPC           | Descripción |
| ------------- | ----------- |
| `Create`      | Crea un producto (`nombre`, `codigo_sku`, `categoria`, `precio`, `stock_actual?`, `stock_minimo?`, `proveedor`). |
| `FindAll`     | Lista productos con paginación y filtros opcionales: `categoria`, `proveedor` y `nombre` (contiene, sin distinguir mayúsculas), `activo` (por defecto `true`) y `stock_bajo`. |
| `FindOne`     | Obtiene un producto activo por `id`. |
| `Update`      | Actualiza parcialmente un producto. El stock no se edita aquí. |
| `Remove`      | Desactiva un producto (soft delete: `activo = false`). |
| `AdjustStock` | Registra una `entrada` o `salida` (`cantidad`, `motivo`) en `historial_productos`. Una salida mayor al stock responde `FAILED_PRECONDITION`. |
| `FindAlerts`  | Lista alertas con paginación y filtro opcional por `estado` (`ACTIVA`, `RESUELTA`). |

### Alertas de stock bajo

Cada cambio de stock (crear, actualizar el mínimo, ajustar, recibir una orden de compra y el seed) llama a `syncLowStockAlert` ([`src/alerts/low-stock-alert.ts`](src/alerts/low-stock-alert.ts)):

- Si `stock_actual <= stock_minimo` y el producto no tiene una alerta `ACTIVA`, se crea una `STOCK_BAJO`.
- Si el stock vuelve a superar el mínimo, sus alertas `ACTIVA` pasan a `RESUELTA`.

### Seed

[`prisma/seed.ts`](prisma/seed.ts) carga los productos de [`prisma/seed-data.ts`](prisma/seed-data.ts) con `pnpm prisma db seed`. Hace upsert por `codigo_sku` sin modificar los existentes, así que Docker lo corre en cada arranque.

### Saga de órdenes de compra (RabbitMQ)

`products-ms` consume la cola `products.purchase-orders` (exchange `syner.events`):

- `purchase-order.created`: valida que el producto exista y esté activo, y responde `purchase-order.product.validated` o `purchase-order.product.rejected` (con `reason`).
- `purchase-order.received`: suma `cantidad` al stock con una `entrada` cuyo motivo es `Orden de compra <id> recibida`. Ese motivo sirve de clave de idempotencia: un mensaje repetido no suma dos veces.

Si un mensaje no se puede procesar, se reintenta una vez; si vuelve a fallar, va a `products.purchase-orders.dlq`.

## Stack

- NestJS (app híbrida gRPC + RabbitMQ, ESM)
- Prisma 7 + PostgreSQL (`@prisma/adapter-pg`)
- `class-validator` / `class-transformer` para validación
- Vitest para pruebas unitarias y e2e
- pnpm como gestor de paquetes

## Puesta en marcha

```bash
pnpm install
cp .env.template .env   # PORT (puerto gRPC), DATABASE_URL y RABBITMQ_URL
pnpm prisma migrate deploy && pnpm prisma db seed
pnpm start:dev          # requiere products-db y RabbitMQ; o todo el stack con `docker compose up -d --build` en la raíz de syner/
```

## Scripts útiles

```bash
pnpm build        # compila a dist/
pnpm start:prod   # ejecuta la build
pnpm proto:gen    # regenera los tipos TS desde los .proto
pnpm test         # pruebas unitarias
pnpm test:e2e     # pruebas e2e
pnpm lint         # oxlint
```
