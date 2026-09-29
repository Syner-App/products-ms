# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **pnpm** (not npm). Native build scripts for Prisma, `protobufjs`, `grpc-tools` and `esbuild` (used by `tsx` for the seed) are allowlisted in `pnpm-workspace.yaml` (`allowBuilds`).

```bash
pnpm install
pnpm start:dev            # watch mode (nest start --watch)
pnpm build                # nest build -> dist/ (uses tsconfig.build.json, rootDir src)
pnpm start:prod           # node dist/main
pnpm lint                 # oxlint --type-aware src/ test/
pnpm format               # prettier (single quotes, trailing commas)
pnpm proto:gen            # regenerate src/generated/proto/*.ts from src/proto/*.proto (ts-proto, protoc via grpc-tools)
pnpm prisma migrate dev   # create/apply migrations against products-db (localhost:5433)
pnpm prisma db seed       # idempotent initial load (prisma/seed.ts via tsx)

pnpm test                 # vitest unit tests (**/*.spec.ts)
pnpm test:e2e             # vitest e2e (**/*.e2e-spec.ts, vitest.config.e2e.ts)
pnpm test:cov

# single file / single test
pnpm vitest run src/products/products.service.spec.ts
pnpm vitest run -t "should be defined"
```

Vitest runs with `globals: true` (`describe`/`it`/`expect` need no import; typed via `vitest/globals` in tsconfig).

Docker: `docker compose up -d --build` from the `syner/` root runs the whole stack in dev mode. It uses the service `Dockerfile`, bind-mounts `src/`, and runs `start:dev`; `node_modules` stays in the image. The compose `environment:` overrides `.env`, which keeps `localhost` for running outside Docker.

## Environment

`src/config/envs.ts` loads `.env` via `dotenv/config` and validates `process.env` with Joi at import time — the app throws on startup if a required var is missing. `PORT` (the gRPC listen port), `DATABASE_URL` and `RABBITMQ_URL` are required (see `.env.template`). Add new env vars to both the `EnvVars` interface and the Joi schema, and expose them through the exported `envs` object; consume config via `envs`, not `process.env` directly.

## Architecture

NestJS 12 **hybrid app** (no HTTP server), the inventory microservice of the `syner` project: it serves products, stock movements and low-stock alerts over **gRPC** (https://docs.nestjs.com/microservices/grpc) and runs the product-validation and stock-receipt steps of the purchase order saga over **RabbitMQ** (https://docs.nestjs.com/microservices/rabbitmq). `main.ts` uses `NestFactory.create` + two `connectMicroservice(..., { inheritAppConfig: true })` calls; global pipes/filters are registered before connecting, and `app.init()` runs before `startAllMicroservices()` so no message is consumed before lifecycle hooks finish. RabbitMQ runs from the `syner/` root `docker-compose.yml`.

- **ESM + `nodenext`**: `package.json` has `"type": "module"`, and `main.ts` uses top-level `await`. Relative imports must include a file extension. Both `.ts` and `.js` extensions appear in the codebase; `rewriteRelativeImportExtensions` in tsconfig rewrites `.ts` to `.js` on emit, so either works — match the surrounding file.
- **Proto contract**: `src/proto/products.proto` (package `products`, service `ProductsService`) is the source of truth. It must live under `src/` so the `**/*.proto` asset rule in `nest-cli.json` copies it to `dist/proto/`, where `main.ts` loads it via `import.meta.dirname`. After editing it, run `pnpm proto:gen` and commit the regenerated `src/generated/proto/products.ts` (ts-proto `nestJs=true,stringEnums=true,snakeToCamel=false` interfaces + `PRODUCTS_PACKAGE_NAME` / `PRODUCTS_SERVICE_NAME`). Fields are snake_case end to end: the gRPC server (and every client, including the gateway and the e2e test) uses `loader: { keepCase: true, enums: String }`, so payloads map 1:1 to the Prisma columns and enums. Responses convert `Date` columns to ISO strings (`toProductResponse` / `toAlertResponse`); `FindAlerts` lives in `src/alerts/alerts.controller.ts` on the same `ProductsService`.
- **Controller**: handlers use `@GrpcMethod(PRODUCTS_SERVICE_NAME, '<RpcName>')` and take the request via `@Payload()` — the decorator is required, otherwise global pipes are not applied to the handler argument.
- **Validation & errors**: `main.ts` registers `ValidationPipe({ whitelist, forbidNonWhitelisted, transform })` with an `exceptionFactory` that throws `RpcException({ code: status.INVALID_ARGUMENT })`. Services throw `RpcException({ code: status.<CODE>, message })` (`status` from `@grpc/grpc-js`), never `HttpException`s, which would reach clients as `UNKNOWN`. DTOs use `class-validator` + `class-transformer`; update DTOs derive from create DTOs via `PartialType` and add the `id` field that travels in the same gRPC message. `stock_actual` only changes through `AdjustStock` (salida uses a conditional `updateMany where stock_actual >= cantidad`, else `FAILED_PRECONDITION`), which also writes `ProductHistory`.
- **Purchase order saga steps** (`src/products/purchase-order-events.controller.ts`): consumes from the topic exchange `syner.events` (queue `products.purchase-orders`, `noAck: false`):
  - `purchase-order.created` → `ProductsService.validateProduct` (exists and `activo`), then publishes `purchase-order.product.validated` (`{ purchaseOrderId, producto_id }`) or, on `INVALID_ARGUMENT`, `purchase-order.product.rejected` (`{ purchaseOrderId, reason }`) through the `PRODUCTS_EVENTS_CLIENT` RMQ proxy (`wildcards: true` → publish to the exchange with the pattern as routing key). Acked only after the broker confirms the reply.
  - `purchase-order.received` → `ProductsService.receivePurchaseOrder`: `entrada` + history + alert sync in one transaction. Idempotent: the history `motivo` (`Orden de compra <id> recibida`) is the dedup key.
  - On failure a message is requeued once, and a redelivered failure is dead-lettered to `products.purchase-orders.dlq` via `syner.dlx` (declared in `syner/rabbitmq/definitions.json`). Invalid payloads are dead-lettered straight away.
- **Low-stock alerts**: `syncLowStockAlert(tx, product)` (`src/alerts/low-stock-alert.ts`, plain function so the seed can reuse it) opens one `STOCK_BAJO`/`ACTIVA` alert when `stock_actual <= stock_minimo` and resolves it once the stock is above the minimum. Call it inside the same transaction after every stock or `stock_minimo` change.
- **RMQ handler rules**: take the payload as `unknown` and validate it with `parseEvent()` (`src/common/events/`), because a failing global pipe would skip the handler and leave the message un-acked. Ack/nack via `rmqMessage(context)` (`src/common/rmq/`). Use `@EventPattern<string>(pattern, Transport.RMQ)`: the typed overload in NestJS 12 rejects a typed `@Ctx()` argument, and the explicit transport keeps the handler off the gRPC server. Event contracts live in `src/common/events/purchase-order.events.ts`, duplicated in orders-ms, so keep them in sync.
- **Persistence**: Prisma 7 with PostgreSQL (`products-db` container, host port 5433) via `@prisma/adapter-pg`; client generated to `src/generated/prisma` (gitignored). Datasource URL and seed command come from `prisma7.config.ts`. Models: `Product` (`productos`), `ProductHistory` (`historial_productos`), `Alerts` (`alertas`). `PrismaService` is provided by the global `PrismaModule` (`src/prisma-service/prisma.module.ts`). Products are soft-deleted (`activo: false`); `FindAll` lists `activo: true` unless asked otherwise. The seed (`prisma/seed.ts`) upserts by `codigo_sku` with `update: {}`, so Docker runs it on every start.
- **Tests**: unit specs mock `PrismaService`/`ProductsService`, the `PRODUCTS_EVENTS_CLIENT` proxy (`emit` returning `of(undefined)`), and build `new RmqContext([message, channel, pattern])` for RMQ handlers. The e2e test starts the real microservice on `localhost:50099` against the dev DB and calls it through a `ClientsModule` gRPC client; it does **not** apply the global `ValidationPipe`.
- **Lint rules** (`.oxlintrc.json`): `no-floating-promises` is an error (type-aware); `no-explicit-any` is off.
