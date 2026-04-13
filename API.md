# API Documentation

Base URL: `http://localhost:3001`

## Authentication

### Admin Endpoints

Use the `X-API-Key` header with the admin API key (set via `ADMIN_API_KEY` env var).

```
X-API-Key: your-admin-secret-key
```

### Tenant Endpoints

Use the `X-API-Key` header with the tenant's API key (returned when creating a tenant).

```
X-API-Key: tenant-api-key
```

The middleware validates that the API key belongs to the tenant specified in the URL `:tenantId` parameter. Returns `403` if there is a mismatch.

### Webhook Endpoints

No API key required. Authentication is done via app-specific signature verification (e.g., HMAC-SHA1 for Intercom).

---

## Health

### `GET /health`

No authentication required.

**Response** `200`

```json
{
  "status": "ok",
  "timestamp": "2026-03-30T12:00:00.000Z"
}
```

---

## Tenants (Admin)

### `POST /api/v1/tenants`

Create a new tenant. Returns a generated API key.

**Auth**: Admin API key

**Request Body**

```json
{
  "name": "Acme Inc",
  "slug": "acme",
  "settings": {
    "auto_send_drafts": false,
    "ai_model": "deepseek-chat",
    "default_language": "en",
    "output_app_ids": [1, 3]
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Company name |
| `slug` | string | yes | URL-friendly identifier (unique) |
| `settings` | object | no | Tenant settings (see README) |

**Response** `201`

```json
{
  "id": 1,
  "name": "Acme Inc",
  "slug": "acme",
  "api_key": "a1b2c3d4e5f6...",
  "settings": {},
  "is_active": true,
  "created_at": "2026-03-30T12:00:00.000Z",
  "updated_at": "2026-03-30T12:00:00.000Z"
}
```

**Errors**: `400` name or slug missing, `401` invalid admin key

---

### `GET /api/v1/tenants/:tenantId`

Get tenant details.

**Auth**: Admin API key

**Response** `200`: Tenant object

**Errors**: `404` tenant not found

---

### `PUT /api/v1/tenants/:tenantId`

Update tenant name or settings.

**Auth**: Admin API key

**Request Body**

```json
{
  "name": "New Name",
  "settings": {
    "auto_send_drafts": true,
    "ai_model": "gpt-4",
    "output_app_ids": [2, 5]
  }
}
```

**Response** `200`: Updated tenant object

**Errors**: `404` tenant not found

---

## Apps

Apps represent connected external services (Intercom, Zendesk, Slack, Notion, etc.). Each app has a **code** (which service), **type** (what purpose), and **role** (data direction).

### `GET /api/v1/tenants/:tenantId/apps`

List configured apps for a tenant.

**Auth**: Tenant API key

**Query Parameters**

| Param | Type | Description |
|-------|------|-------------|
| `type` | string | Filter by type (`ticket`, `knowledge`, `notification`) |
| `role` | string | Filter by role (`source`, `destination`, `both`) |
| `code` | string | Filter by service code (`intercom`, `zendesk`) |
| `is_active` | string | Filter by active status (`true`/`false`) |

**Response** `200`

```json
[
  {
    "id": 1,
    "tenant_id": 1,
    "code": "intercom",
    "type": "ticket",
    "role": "both",
    "name": "Main Intercom",
    "credentials": { "accessToken": "tok-123", "clientSecret": "sec-456" },
    "webhook_secret": "wh-secret",
    "config": {},
    "is_active": true,
    "created_at": "2026-03-30T12:00:00.000Z",
    "updated_at": "2026-03-30T12:00:00.000Z"
  }
]
```

---

### `GET /api/v1/tenants/:tenantId/apps/:appId`

Get a single app.

**Auth**: Tenant API key

**Response** `200`: App object

**Errors**: `404` app not found

---

### `POST /api/v1/tenants/:tenantId/apps`

Add an app configuration.

**Auth**: Tenant API key

**Request Body**

```json
{
  "code": "intercom",
  "type": "ticket",
  "role": "both",
  "name": "Main Intercom Account",
  "credentials": {
    "accessToken": "your-intercom-token",
    "clientSecret": "your-client-secret"
  },
  "webhook_secret": "optional-webhook-secret",
  "config": {}
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | string | yes | Service code (`intercom`, `zendesk`, `slack`, `notion`) |
| `type` | string | yes | App type: `ticket`, `knowledge`, or `notification` |
| `role` | string | yes | Data direction: `source`, `destination`, or `both` |
| `name` | string | no | Human-readable label |
| `credentials` | object | yes | Service-specific credentials |
| `webhook_secret` | string | no | Webhook verification secret |
| `config` | object | no | Extra configuration (e.g., `{ "feed_kb": true }`) |

**Intercom credentials** (type: `ticket`):
- `accessToken` -- Bearer token for API calls
- `clientSecret` -- OAuth client secret for webhook HMAC-SHA1 verification

**Response** `201`: App object

**Errors**: `400` required fields missing or invalid type/role

---

### `PUT /api/v1/tenants/:tenantId/apps/:appId`

Update an app configuration.

**Auth**: Tenant API key

**Request Body**

```json
{
  "name": "Updated Name",
  "credentials": { "accessToken": "new-token" },
  "webhook_secret": "new-secret",
  "config": { "feed_kb": true },
  "is_active": false,
  "role": "destination"
}
```

**Response** `200`: Updated app object

**Errors**: `400` invalid role, `404` app not found

---

### `DELETE /api/v1/tenants/:tenantId/apps/:appId`

Remove an app configuration.

**Auth**: Tenant API key

**Response** `204` No Content

---

## Tickets

### `GET /api/v1/tenants/:tenantId/tickets`

List synced tickets for the tenant.

**Auth**: Tenant API key

**Query Parameters**

| Param | Type | Description |
|-------|------|-------------|
| `input_app_id` | number | Filter by input app ID |
| `state` | string | Filter by state (`open`, `pending`, `resolved`, `closed`) |
| `customer_id` | number | Filter by customer ID |
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20) |

**Response** `200`

```json
{
  "data": [
    {
      "id": 1,
      "tenant_id": 1,
      "customer_id": 5,
      "input_app_id": 1,
      "output_app_id": 1,
      "external_id": "conv_456",
      "state": "open",
      "subject": "Cannot login",
      "initial_body": "I'm having trouble logging in...",
      "language": "en",
      "assignee_id": "admin_123",
      "external_created_at": "2026-03-29T10:00:00.000Z",
      "external_updated_at": "2026-03-30T08:00:00.000Z",
      "synced_at": "2026-03-30T12:00:00.000Z",
      "created_at": "2026-03-30T12:00:00.000Z",
      "updated_at": "2026-03-30T12:00:00.000Z"
    }
  ]
}
```

---

### `GET /api/v1/tenants/:tenantId/tickets/:id`

Get a single ticket with its messages and customer info.

**Auth**: Tenant API key

**Response** `200`

```json
{
  "ticket": {
    "id": 1,
    "tenant_id": 1,
    "input_app_id": 1,
    "output_app_id": 1,
    "subject": "Cannot login",
    "state": "open",
    "customer_email": "jane@example.com",
    "customer_name": "Jane Doe"
  },
  "messages": [
    {
      "id": 1,
      "ticket_id": 1,
      "tenant_id": 1,
      "external_id": "msg_001",
      "author_role": "customer",
      "author_name": "Jane Doe",
      "body": "I'm having trouble logging in...",
      "external_created_at": "2026-03-29T10:00:00.000Z",
      "created_at": "2026-03-30T12:00:00.000Z"
    }
  ]
}
```

**Errors**: `404` ticket not found

---

### `POST /api/v1/tenants/:tenantId/tickets/sync`

Trigger a manual sync from an app. Responds immediately and runs the sync in the background.

**Auth**: Tenant API key

**Request Body**

```json
{
  "app_id": 1
}
```

**Response** `200`

```json
{
  "message": "Sync started"
}
```

**Errors**: `400` app_id missing, `404` app not configured

---

### `PATCH /api/v1/tenants/:tenantId/tickets/:id/output-app`

Override the output app for a specific ticket. This determines where the AI draft reply will be sent.

**Auth**: Tenant API key

**Request Body**

```json
{
  "output_app_id": 5
}
```

**Response** `200`: Updated ticket object

**Errors**: `400` output_app_id missing or app is source-only, `404` ticket or app not found

---

## Customers

### `GET /api/v1/tenants/:tenantId/customers`

List customers for the tenant.

**Auth**: Tenant API key

**Query Parameters**

| Param | Type | Description |
|-------|------|-------------|
| `email` | string | Filter by exact email |
| `name` | string | Filter by name (ILIKE) |
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20) |

**Response** `200`

```json
{
  "data": [
    {
      "id": 5,
      "tenant_id": 1,
      "external_id": "contact_1",
      "email": "jane@example.com",
      "name": "Jane Doe",
      "phone": "+1234567890",
      "metadata": {
        "total_orders": 12,
        "plan": "premium",
        "country": "TR"
      },
      "created_at": "2026-03-30T12:00:00.000Z",
      "updated_at": "2026-03-30T12:00:00.000Z"
    }
  ]
}
```

---

### `GET /api/v1/tenants/:tenantId/customers/:id`

Get a single customer.

**Auth**: Tenant API key

**Response** `200`: Customer object

**Errors**: `404` customer not found

---

### `POST /api/v1/tenants/:tenantId/customers`

Create or update a customer (upserts by email within the tenant).

**Auth**: Tenant API key

**Request Body**

```json
{
  "email": "jane@example.com",
  "name": "Jane Doe",
  "phone": "+1234567890",
  "external_id": "contact_1",
  "metadata": {
    "total_orders": 12,
    "plan": "premium"
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | yes | Customer email (unique per tenant) |
| `name` | string | no | Display name |
| `phone` | string | no | Phone number |
| `external_id` | string | no | External system's customer ID |
| `metadata` | object | no | Arbitrary metadata (orders, plan, etc.) |

**Response** `201`: Customer object (created or updated)

**Errors**: `400` email missing

---

### `PUT /api/v1/tenants/:tenantId/customers/:id/metadata`

Update customer metadata. Merges with existing metadata.

**Auth**: Tenant API key

**Request Body**

```json
{
  "metadata": {
    "tier": "gold",
    "region": "eu"
  }
}
```

**Response** `200`: Updated customer object

**Errors**: `400` metadata missing, `404` customer not found

---

## Knowledge Articles

### `GET /api/v1/tenants/:tenantId/knowledge-articles`

List knowledge base articles for the tenant.

**Auth**: Tenant API key

**Query Parameters**

| Param | Type | Description |
|-------|------|-------------|
| `category` | string | Filter by category |
| `search` | string | Search in title and content (ILIKE) |
| `is_active` | string | Filter by active status (`true`/`false`) |
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20) |

**Response** `200`

```json
{
  "data": [
    {
      "id": 1,
      "tenant_id": 1,
      "title": "Getting Started",
      "content": "Here is how to get started...",
      "category": "onboarding",
      "language": "en",
      "is_active": true,
      "created_at": "2026-03-30T12:00:00.000Z",
      "updated_at": "2026-03-30T12:00:00.000Z"
    }
  ]
}
```

---

### `GET /api/v1/tenants/:tenantId/knowledge-articles/:id`

Get a single article.

**Auth**: Tenant API key

**Response** `200`: Article object

**Errors**: `404` article not found

---

### `POST /api/v1/tenants/:tenantId/knowledge-articles`

Create a knowledge article. Automatically generates an embedding for RAG search.

**Auth**: Tenant API key

**Request Body**

```json
{
  "title": "Getting Started",
  "content": "Here is how to get started with our platform...",
  "category": "onboarding",
  "language": "en"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | yes | Article title |
| `content` | string | yes | Article body |
| `category` | string | no | Category tag |
| `language` | string | no | Language code (default: `en`) |

**Response** `201`: Article object

**Errors**: `400` title or content missing

---

### `PUT /api/v1/tenants/:tenantId/knowledge-articles/:id`

Update an article. Re-generates embedding if title or content changes.

**Auth**: Tenant API key

**Request Body**

```json
{
  "title": "Updated Title",
  "content": "Updated content...",
  "category": "faq",
  "language": "tr"
}
```

**Response** `200`: Updated article object

**Errors**: `404` article not found

---

### `DELETE /api/v1/tenants/:tenantId/knowledge-articles/:id`

Soft-delete an article (sets `is_active = false`).

**Auth**: Tenant API key

**Response** `204` No Content

**Errors**: `404` article not found

---

## Drafts

### `POST /api/v1/tenants/:tenantId/tickets/:id/draft`

Generate an AI draft response for a ticket using the RAG pipeline.

The pipeline:
1. Loads ticket, messages, and linked customer
2. Embeds the latest customer message
3. Searches knowledge base for similar articles (pgvector cosine similarity)
4. Searches past agent replies for similar responses
5. Builds customer context (metadata, history)
6. Calls the AI service with assembled context
7. Stores the draft with `status: pending`

**Auth**: Tenant API key

**Response** `201`

```json
{
  "id": 10,
  "ticket_id": 1,
  "tenant_id": 1,
  "prompt_context": "## Customer Profile\nName: Jane Doe...\n## Knowledge Base\n...",
  "draft_response": "Hi Jane, I understand you're having trouble logging in...",
  "ai_model": "deepseek-chat",
  "ai_tokens_used": 350,
  "status": "pending",
  "reviewed_by": null,
  "reviewed_at": null,
  "created_at": "2026-03-30T12:00:00.000Z"
}
```

---

### `GET /api/v1/tenants/:tenantId/tickets/:id/drafts`

List all drafts for a ticket.

**Auth**: Tenant API key

**Response** `200`

```json
[
  {
    "id": 10,
    "ticket_id": 1,
    "tenant_id": 1,
    "draft_response": "Hi Jane, I understand...",
    "status": "pending",
    "created_at": "2026-03-30T12:00:00.000Z"
  }
]
```

---

### `PATCH /api/v1/tenants/:tenantId/drafts/:id`

Approve or reject a draft.

**Auth**: Tenant API key

**Request Body**

```json
{
  "status": "approved",
  "reviewed_by": "admin@example.com"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | string | yes | `approved` or `rejected` |
| `reviewed_by` | string | no | Reviewer identifier |

**Response** `200`: Updated draft object (includes `reviewed_at` timestamp)

**Errors**: `400` invalid status, `404` draft not found

---

### `POST /api/v1/tenants/:tenantId/drafts/:id/send`

Send an approved draft to the resolved output app(s). Uses the output routing logic:
1. Ticket-level `output_app_id` override
2. Tenant-level `output_app_ids` fan-out pipeline
3. Fallback to input app (if role is `both`)

Supports **fan-out**: if multiple output apps are configured, the draft is sent to all of them in parallel via `Promise.allSettled()`.

**Auth**: Tenant API key

**Response** `200`

```json
{
  "message": "Draft sent successfully"
}
```

**Errors**: `400` draft not approved, `404` draft not found, `500` no output app configured

---

## Webhooks

### `POST /webhooks/:tenantSlug/:appId`

Receive webhook events from ticket apps. No API key required -- authentication is done via app-specific signature verification.

**URL Examples**:
- `/webhooks/acme/1` (app ID 1)
- `/webhooks/bigcorp/5` (app ID 5)

The `:appId` parameter is the numeric ID of the app (returned when creating an app). Only apps with `type: 'ticket'` and `role: 'source'` or `'both'` can receive webhooks.

**Intercom Headers**:
- `X-Hub-Signature`: `sha1=<hmac-hex-digest>` (HMAC-SHA1 using the app's `clientSecret`)

**Processing**:
1. Resolves tenant from `:tenantSlug`
2. Loads app from `:appId`
3. Verifies signature using app adapter
4. Responds `200` immediately
5. Processes event asynchronously:
   - `new_ticket` -- Upserts ticket + links/creates customer
   - `new_customer_reply` -- Upserts message, generates AI draft, optionally auto-sends
   - `ticket_closed` -- Updates state, embeds agent replies for future RAG
   - `ticket_assigned` -- Updates assignee

**Response** `200`

```json
{
  "message": "Webhook received"
}
```

**Errors**: `400` invalid app ID or app not configured as input, `401` invalid signature, `403` tenant inactive, `404` tenant not found

---

## Error Responses

All errors follow a consistent format:

```json
{
  "error": "Description of what went wrong"
}
```

| Status | Meaning |
|--------|---------|
| `400` | Bad request (missing required fields, invalid values) |
| `401` | Unauthorized (missing or invalid API key / webhook signature) |
| `403` | Forbidden (API key doesn't match the tenant, or tenant inactive) |
| `404` | Resource not found |
| `500` | Internal server error |
