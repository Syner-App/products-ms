<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

<h1 align="center">products-ms</h1>

<p align="center">Microservicio de productos del proyecto <strong>Syner</strong>, construido con NestJS y gRPC.</p>

## Descripción

`products-ms` es el microservicio encargado de la gestión del catálogo de productos dentro de la arquitectura de microservicios de Syner. Expone su API exclusivamente mediante **gRPC** (sin servidor HTTP) y persiste los datos con **Prisma** sobre **SQLite**.

El contrato del servicio está definido en [`src/proto/products.proto`](src/proto/products.proto) (`products.ProductsService`) y ofrece las siguientes operaciones:

| RPC       | Descripción                                   |
| --------- | --------------------------------------------- |
| `Create`  | Crea un producto (`name`, `price`).           |
| `FindAll` | Lista productos disponibles con paginación.   |
| `FindOne` | Obtiene un producto por `id`.                 |
| `Update`  | Actualiza parcialmente un producto.           |
| `Remove`  | Elimina un producto (soft delete: `available = false`). |

## Stack

- NestJS (microservicio gRPC, ESM)
- Prisma 7 + SQLite (`better-sqlite3`)
- `class-validator` / `class-transformer` para validación
- Vitest para pruebas unitarias y e2e
- pnpm como gestor de paquetes

## Puesta en marcha

```bash
pnpm install
cp .env.template .env   # PORT (puerto gRPC) y DATABASE_URL
pnpm start:dev
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
