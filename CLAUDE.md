# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **pnpm** (not npm). Native build scripts for Prisma and `better-sqlite3` are allowlisted in `pnpm-workspace.yaml` (`allowBuilds`).

```bash
pnpm install
pnpm start:dev            # watch mode (nest start --watch)
pnpm build                # nest build -> dist/ (uses tsconfig.build.json, rootDir src)
pnpm start:prod           # node dist/main
pnpm lint                 # oxlint --type-aware src/ test/
pnpm format               # prettier (single quotes, trailing commas)

pnpm test                 # vitest unit tests (**/*.spec.ts)
pnpm test:e2e             # vitest e2e (**/*.e2e-spec.ts, vitest.config.e2e.ts)
pnpm test:cov

# single file / single test
pnpm vitest run src/products/products.service.spec.ts
pnpm vitest run -t "should be defined"
```

Vitest runs with `globals: true` (`describe`/`it`/`expect` need no import; typed via `vitest/globals` in tsconfig).

## Environment

`src/config/envs.ts` loads `.env` via `dotenv/config` and validates `process.env` with Joi at import time — the app throws on startup if a required var is missing. Currently only `PORT` is required (see `.env.template`). Add new env vars to both the `EnvVars` interface and the Joi schema, and expose them through the exported `envs` object; consume config via `envs`, not `process.env` directly.

## Architecture

NestJS 12 HTTP service (Express platform), intended as the products microservice of the `syner` project.

- **ESM + `nodenext`**: `package.json` has `"type": "module"`, and `main.ts` uses top-level `await`. Relative imports must include a file extension. Both `.ts` and `.js` extensions appear in the codebase; `rewriteRelativeImportExtensions` in tsconfig rewrites `.ts` to `.js` on emit, so either works — match the surrounding file.
- **Global validation**: `main.ts` registers `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })`, so requests with properties not declared on a DTO are rejected. DTOs use `class-validator` + `class-transformer`; update DTOs derive from create DTOs via `PartialType` from `@nestjs/mapped-types`. Note the e2e test bootstraps `AppModule` directly and does **not** apply this pipe.
- **Feature modules**: `src/products/` follows the Nest resource-generator layout (module / controller / service / `dto/` / `entities/`) and is imported into `AppModule`. `ProductsService` is still scaffold stubs returning strings — no persistence is wired yet.
- **Persistence (planned)**: `@prisma/client`, `prisma`, and `@prisma/adapter-better-sqlite3` are installed, but there is no `prisma/` schema or Prisma service yet.
- **Lint rules** (`.oxlintrc.json`): `no-floating-promises` is an error (type-aware); `no-explicit-any` is off.
