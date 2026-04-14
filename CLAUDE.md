# Project Rules

## Architecture

- **API** (`src/index.ts`) — Express HTTP server, no background jobs
- **Worker** (`src/worker.ts`) — BullMQ consumers, no HTTP
- **Queue system** — BullMQ + Redis with scanner→fan-out pattern
- **Database** — PostgreSQL with pgvector, UUID v7 primary keys, Prisma ORM
- **AI SDK** — `@yengec/ai` standalone package at `packages/yengec-ai/`

## Code Conventions

- All IDs are UUID v7 strings (generated via `src/utils/uuid.ts`)
- All API responses use snake_case (via `toSnakeCase()` serializer)
- All routes have NO `/api/v1/` prefix
- Repository → Service → Controller layering
- Tenant isolation enforced at repository level (every query includes `tenantId`)

## When Adding a New Service/Endpoint

Every new endpoint MUST include:

1. **OpenAPI spec** — Add the endpoint to `openapi.yaml` with request/response schemas
2. **Feature test** — Add a test in `tests/feature/` that covers the happy path and error cases
3. **Controller** — In `src/controllers/`, handles HTTP, validation, serialization
4. **Service** — In `src/services/`, business logic only
5. **Repository** — In `src/repositories/`, database queries only

## When Adding a New Background Job

1. Add queue name to `src/queues/queues.ts` → `QUEUE_NAMES`
2. Create processor in `src/queues/processors/`
3. Register worker in `src/worker.ts`
4. If recurring: add scanner schedule in `src/scheduler/index.ts`

## Authentication

- `adminAuth` — `X-API-Key` header matching `ADMIN_API_KEY` env var
- `tenantOrUserAuth` — accepts either `X-API-Key` (tenant) or `Bearer` JWT (user)
- `userAuth` — JWT only, checks tenant_users membership for tenant-scoped routes
- `requireRole(...roles)` — checks `req.tenantUser.role`, no-op for API key auth

## Testing

- Framework: Vitest + Supertest
- Database: PGlite (in-memory PostgreSQL, no Docker needed)
- Run: `npm test`
- All tests must pass before merging
- Feature tests use lazy app init: `const mod = await import('../../src/index')`

## Database Migrations

- SQL files in `src/database/migrations/`, run in alphabetical order
- Custom runner at `src/database/migrate.ts`
- All tables use UUID primary keys (no auto-increment)
- Use `generateId()` from `src/utils/uuid` when creating records

## Language

- All code, comments, commit messages, documentation, and API specs must be in English
