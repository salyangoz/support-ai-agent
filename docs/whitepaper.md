# Yengec Support AI Agent — Technical Whitepaper

## Overview

A multi-tenant, provider-agnostic AI draft response system for customer support. It integrates with support platforms (Intercom, etc.), syncs tickets, and uses RAG (Retrieval-Augmented Generation) to generate context-aware draft replies using tenant-configurable AI providers.

## System Architecture

```
                         ┌──────────────┐
                         │   Ingress    │
                         │  (nginx/TLS) │
                         └──────┬───────┘
                                │
                   ┌────────────┼────────────┐
                   ▼            ▼            ▼
             ┌──────────┐ ┌──────────┐ ┌──────────┐
             │  API-1   │ │  API-2   │ │  API-N   │
             │  :3001   │ │  :3001   │ │  :3001   │
             └────┬─────┘ └────┬─────┘ └────┬─────┘
                  │            │            │
                  └────────────┼────────────┘
                          ┌────┴────┐
                          │  Redis  │
                          └────┬────┘
                  ┌────────────┼────────────┐
                  ▼            ▼            ▼
             ┌──────────┐ ┌──────────┐ ┌──────────┐
             │ Worker-1 │ │ Worker-2 │ │ Worker-N │
             └────┬─────┘ └────┬─────┘ └────┬─────┘
                  │            │            │
                  └────────────┼────────────┘
                          ┌────┴────┐
                          │ Postgres│
                          │+pgvector│
                          └─────────┘
                               │
                          ┌────┴────┐
                          │ Yengec  │
                          │ AI SDK  │
                          └─────────┘
```

### Processes

| Process | Role | Scalable | How |
|---------|------|----------|-----|
| **API** | HTTP server, webhooks, Bull Board dashboard | Yes — stateless, scale horizontally | K8s HPA on CPU |
| **Worker** | BullMQ job consumers | Yes — multiple workers compete for jobs | K8s HPA on CPU |
| **Redis** | Job queue storage | Single instance (or Redis Cluster) | — |
| **PostgreSQL** | Data store + pgvector embeddings | Single primary (UUID v7 ready for sharding) | — |

## Multi-Tenancy

Every resource belongs to a tenant. Isolation is enforced at the database layer — every query includes a `tenant_id` WHERE clause. Tenants are identified by:

- **API key** (`X-API-Key` header) — for machine-to-machine integrations
- **JWT token** (`Authorization: Bearer`) — for human users

A single user can belong to multiple tenants with different roles (`owner`, `admin`, `member`) via the `tenant_users` join table.

### Data Model

```
Tenant
├── TenantUser[] ──→ User (many-to-many, role per membership)
├── App[] (source/destination/both × ticket/knowledge/notification)
├── Customer[]
│   └── Ticket[]
│       ├── Message[] (with pgvector embeddings)
│       └── Draft[]
└── KnowledgeArticle[] (with pgvector embeddings)
```

All primary keys are **UUID v7** (time-sortable, shard-friendly). Generated at the application layer via `uuid.v7()`.

## Authentication & Authorization

```
Request
  │
  ├─ X-API-Key header? → tenantAuth (validate key → attach tenant)
  │
  └─ Bearer token? → userAuth (verify JWT → load user → check tenant_users membership)
       │
       └─ requireRole('owner','admin') → check tenantUser.role
```

JWT tokens contain only `userId` (no tenant ID), since users can access multiple tenants. The tenant is determined by the URL parameter (`:tenantId`), and membership is verified on each request.

## Provider Integration (Apps)

Apps are the abstraction layer between the system and external support platforms.

```
App {
  code: 'intercom' | 'zendesk' | ...
  type: 'ticket' | 'knowledge' | 'notification'
  role: 'source' | 'destination' | 'both'
  credentials: { accessToken, clientSecret, ... }
}
```

The **App Factory** pattern creates provider-specific adapters:

```
createInputApp(app)  → InputApp  { fetchRecentTickets, fetchTicketMessages, verifyWebhook, parseWebhook }
createOutputApp(app) → OutputApp { sendReply }
```

### Data Flow: Inbound

```
Provider (Intercom)
  │
  ├─ Webhook POST /webhooks/:tenantSlug/:appId
  │    → HMAC signature verification
  │    → Parse event (new_ticket, new_customer_reply, ticket_closed, ticket_assigned)
  │    → Upsert customer, ticket, message
  │    → Generate AI draft (if new_customer_reply)
  │    → Auto-send draft (if tenant.settings.auto_send_drafts)
  │
  └─ Polling (every 10 min via scanner job)
       → Fetch recent tickets from provider API
       → Upsert customers, tickets, messages
       → Embed agent messages for RAG
```

### Data Flow: Outbound

```
Draft approved
  │
  └─ POST /tenants/:tenantId/drafts/:id/send
       → Resolve output apps (ticket override → tenant pipeline → input app fallback)
       → Fan-out: send reply to all output apps in parallel
       → Update draft status to 'sent'
```

## RAG Pipeline (Draft Generation)

```
Customer sends message
  │
  ▼
1. Embed customer message (Yengec AI SDK → /embed)
  │
  ▼
2. Semantic search: find similar KB articles (pgvector cosine similarity, top K)
  │
  ▼
3. Semantic search: find similar past agent replies (pgvector, limit 2)
  │
  ▼
4. Build context:
   ├─ Customer profile (name, email, previous ticket count, metadata)
   ├─ Relevant KB articles (title + content)
   ├─ Similar past replies (question + answer)
   └─ Current conversation (last 5 messages)
  │
  ▼
5. Call AI (Yengec AI SDK → /chat)
   ├─ service: tenant.settings.ai_service (openai, deepseek, ...)
   ├─ model: tenant.settings.ai_model (gpt-4, deepseek-chat, ...)
   ├─ credentials: tenant.settings.ai_credentials
   ├─ instructions: [system prompt + context]
   └─ question: latest customer message
  │
  ▼
6. Store draft (status: pending)
  │
  ▼
7. Human review → approve/reject → send
```

## Job Queue Architecture (BullMQ)

The system uses a **scanner → fan-out** pattern for maximum parallelism:

```
Repeatable Scanner Jobs (every 10 min)
  │
  ├─ scan-ticket-sync
  │    → For each active tenant+app pair: enqueue sync-tenant-app job
  │
  ├─ scan-message-embeddings
  │    → For each message with embedding IS NULL: enqueue embed-message job
  │
  └─ scan-article-embeddings
       → For each KB article with embedding IS NULL: enqueue embed-article job

Granular Worker Jobs (processed in parallel)
  │
  ├─ sync-tenant-app      { tenantId, appId }         concurrency: 3
  ├─ embed-message         { messageId, body, creds }  concurrency: 5
  └─ embed-article         { articleId, text, creds }  concurrency: 5
```

### Deduplication

Two layers prevent duplicate work:

1. **BullMQ jobId** — `embed-art-{articleId}` prevents the same article from being queued twice
2. **DB filter** — only rows with `embedding IS NULL` are returned by the scanner query

### Monitoring

Bull Board dashboard is available at `/queues` on the API server. It shows:
- Queue sizes (waiting, active, completed, failed)
- Job history and timing
- Failed job details and retry controls

## Embedding Storage

Embeddings are stored as PostgreSQL `vector(1536)` columns using the pgvector extension. Two tables have embeddings:

- `messages.embedding` — agent messages, used for finding similar past replies
- `knowledge_articles.embedding` — KB articles, used for RAG context retrieval

Similarity search uses cosine distance: `ORDER BY embedding <=> $1::vector LIMIT $2`

## Yengec AI SDK (`@yengec/ai`)

Standalone npm package at `packages/yengec-ai/`. Wraps the Yengec AI service API:

```typescript
const ai = new YengecAi({ baseUrl: 'https://ai.yengec.co' });

// Chat completion
await ai.chat({ service, model, credentials, instructions, question });

// Text embedding
await ai.embed({ text, credentials });
```

Tenants configure their own AI provider and credentials in `tenant.settings`:

```json
{
  "ai_service": "openai",
  "ai_model": "gpt-4",
  "ai_credentials": { "api_key": "sk-..." }
}
```

## Kubernetes Deployment

```
k8s/
├── configmap.yaml         (NODE_ENV, PORT, REDIS_URL, YENGEC_AI_BASE_URL)
├── secret.yaml            (DATABASE_URL, JWT_SECRET, SENTRY_DSN)
├── external-redis.yaml    (Service + Endpoints → host-side Redis)
├── deployment.yaml        (API + Scheduler + Worker deployments)
├── service.yaml           (ClusterIP → API pods only)
├── ingress.yaml           (TLS termination → support-api.yengec.co)
└── hpa.yaml               (API: 2-10 pods, Worker: 1-5 pods)
```

Same Docker image, different entrypoint:
- API: `node dist/index.js`
- Worker: `node dist/worker.js`

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20 + TypeScript |
| HTTP | Express 4 |
| Database | PostgreSQL + pgvector |
| ORM | Prisma |
| Queue | BullMQ + Redis |
| Auth | JWT (bcryptjs + jsonwebtoken) |
| AI | Yengec AI SDK (axios-based) |
| Testing | Vitest + Supertest + PGlite |
| IDs | UUID v7 |
| Container | Docker (multi-stage build) |
| Orchestration | Kubernetes |
