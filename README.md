<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

<h1 align="center">products-ms</h1>

<p align="center">Microservicio de productos del proyecto <strong>Syner</strong>, construido con NestJS, gRPC y RabbitMQ.</p>

## Descripción

`products-ms` es el microservicio encargado de la gestión del catálogo de productos dentro de la arquitectura de microservicios de Syner. Expone su API mediante **gRPC** (sin servidor HTTP), persiste los datos con **Prisma** sobre **SQLite** y participa en la **saga de órdenes** por **RabbitMQ**.

El contrato del servicio está definido en [`src/proto/products.proto`](src/proto/products.proto) (`products.ProductsService`) y ofrece las siguientes operaciones:

| RPC       | Descripción                                   |
| --------- | --------------------------------------------- |
| `Create`  | Crea un producto (`name`, `price`).           |
| `FindAll` | Lista productos disponibles con paginación.   |
| `FindOne` | Obtiene un producto por `id`.                 |
| `Update`  | Actualiza parcialmente un producto.           |
| `Remove`  | Elimina un producto (soft delete: `available = false`). |

### Saga de órdenes (RabbitMQ)

`products-ms` consume `order.created` (cola `products.order-validation`, exchange `syner.events`), valida los productos y responde con uno de dos eventos:

- `order.products.validated`, con `id`, `name` y `price` de cada producto.
- `order.products.rejected`, con el motivo.

Si un mensaje no se puede procesar, se reintenta una vez; si vuelve a fallar, va a `products.order-validation.dlq`.

## Stack

- NestJS (app híbrida gRPC + RabbitMQ, ESM)
- Prisma 7 + SQLite (`better-sqlite3`)
- `class-validator` / `class-transformer` para validación
- Vitest para pruebas unitarias y e2e
- pnpm como gestor de paquetes

## Puesta en marcha

```bash
pnpm install
cp .env.template .env   # PORT (puerto gRPC), DATABASE_URL y RABBITMQ_URL
pnpm start:dev          # requiere RabbitMQ; o todo el stack con `docker compose up -d --build` en la raíz de syner/
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
