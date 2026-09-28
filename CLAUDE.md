# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **pnpm** (not npm). Native build scripts for Prisma, `better-sqlite3`, `protobufjs` and `grpc-tools` are allowlisted in `pnpm-workspace.yaml` (`allowBuilds`).

```bash
pnpm install
pnpm start:dev            # watch mode (nest start --watch)
pnpm build                # nest build -> dist/ (uses tsconfig.build.json, rootDir src)
pnpm start:prod           # node dist/main
pnpm lint                 # oxlint --type-aware src/ test/
pnpm format               # prettier (single quotes, trailing commas)
pnpm proto:gen            # regenerate src/generated/proto/*.ts from src/proto/*.proto (ts-proto, protoc via grpc-tools)

pnpm test                 # vitest unit tests (**/*.spec.ts)
pnpm test:e2e             # vitest e2e (**/*.e2e-spec.ts, vitest.config.e2e.ts)
pnpm test:cov

# single file / single test
pnpm vitest run src/products/products.service.spec.ts
pnpm vitest run -t "should be defined"
```

Vitest runs with `globals: true` (`describe`/`it`/`expect` need no import; typed via `vitest/globals` in tsconfig).

## Environment

`src/config/envs.ts` loads `.env` via `dotenv/config` and validates `process.env` with Joi at import time — the app throws on startup if a required var is missing. `PORT` (the gRPC listen port) and `DATABASE_URL` are required (see `.env.template`). Add new env vars to both the `EnvVars` interface and the Joi schema, and expose them through the exported `envs` object; consume config via `envs`, not `process.env` directly.

## Architecture

NestJS 12 **gRPC microservice** (`NestFactory.createMicroservice` with `Transport.GRPC`, no HTTP server), the products microservice of the `syner` project. Follows https://docs.nestjs.com/microservices/grpc.

- **ESM + `nodenext`**: `package.json` has `"type": "module"`, and `main.ts` uses top-level `await`. Relative imports must include a file extension. Both `.ts` and `.js` extensions appear in the codebase; `rewriteRelativeImportExtensions` in tsconfig rewrites `.ts` to `.js` on emit, so either works — match the surrounding file.
- **Proto contract**: `src/proto/products.proto` (package `products`, service `ProductsService`) is the source of truth. It must live under `src/` so the `**/*.proto` asset rule in `nest-cli.json` copies it to `dist/proto/`, where `main.ts` loads it via `import.meta.dirname`. After editing it, run `pnpm proto:gen` and commit the regenerated `src/generated/proto/products.ts` (ts-proto `nestJs=true` interfaces + `PRODUCTS_PACKAGE_NAME` / `PRODUCTS_SERVICE_NAME`).
- **Controller**: handlers use `@GrpcMethod(PRODUCTS_SERVICE_NAME, '<RpcName>')` and take the request via `@Payload()` — the decorator is required, otherwise global pipes are not applied to the handler argument.
- **Validation & errors**: `main.ts` registers `ValidationPipe({ whitelist, forbidNonWhitelisted, transform })` with an `exceptionFactory` that throws `RpcException({ code: status.INVALID_ARGUMENT })`. Services throw `RpcException({ code: status.<CODE>, message })` (`status` from `@grpc/grpc-js`), never `HttpException`s, which would reach clients as `UNKNOWN`. DTOs use `class-validator` + `class-transformer`; update DTOs derive from create DTOs via `PartialType` and add the `id` field that travels in the same gRPC message.
- **Persistence**: Prisma 7 with SQLite via `@prisma/adapter-better-sqlite3`; client generated to `src/generated/prisma` (gitignored). `PrismaService` (`src/prisma-service/`) is provided in `ProductsModule`. Products are soft-deleted (`available: false`).
- **Tests**: unit specs mock `PrismaService`/`ProductsService`. The e2e test starts the real microservice on `localhost:50099` against the dev DB and calls it through a `ClientsModule` gRPC client; it does **not** apply the global `ValidationPipe`.
- **Lint rules** (`.oxlintrc.json`): `no-floating-promises` is an error (type-aware); `no-explicit-any` is off.
