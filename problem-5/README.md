# Problem 5 — Token Registry CRUD API

An ExpressJS + **TypeScript (strict)** CRUD service with **SQLite** persistence. The resource is a **crypto token registry** (symbol, name, chain, decimals, active flag) — chosen to match the domain rather than another to-do list.

## Quick start

```bash
npm install
npm run dev        # hot-reload dev server on http://localhost:3000
```

Interactive API docs (Swagger UI): **http://localhost:3000/docs** — generated at boot from the same Zod schemas that validate requests, so the docs cannot drift from the behavior. Raw spec at `/openapi.json`.

Production:

```bash
npm run build && npm start
```

Verify everything works end-to-end (boots the real HTTP stack on an in-memory DB and exercises every endpoint **including the 400/404/409 error paths**):

```bash
npm run smoke
# SMOKE PASS — every endpoint incl. 400/404/409 error paths verified
```

### Configuration

| Env var | Default | Meaning |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `DB_PATH` | `data.db` | SQLite file path; `:memory:` for ephemeral |

No external database server needed — the DB file is created and migrated on first boot.

## API

Base URL: `/api/v1/tokens`. All responses share one envelope: `{ data, pagination? }` on success, `{ error: { code, message, details? } }` on failure.

| Method | Path | Purpose | Failure codes |
|---|---|---|---|
| `POST` | `/api/v1/tokens` | Create a token (returns `201` + `Location` header) | `400` validation, `409` duplicate symbol |
| `GET` | `/api/v1/tokens` | List with filters + pagination | `400` bad query param |
| `GET` | `/api/v1/tokens/:id` | Get one | `404` |
| `PATCH` | `/api/v1/tokens/:id` | Partial update | `400`, `404`, `409` |
| `DELETE` | `/api/v1/tokens/:id` | Delete (returns `204`) | `404` |
| `GET` | `/healthz` | Liveness probe | — |
| `GET` | `/docs` | Swagger UI (generated from the Zod schemas) | — |
| `GET` | `/openapi.json` | Raw OpenAPI 3.0 document | — |

### List filters

```
GET /api/v1/tokens?chain=Ethereum&isActive=true&search=eth&sort=symbol&order=asc&page=1&limit=20
```

- `chain` — exact match (`Ethereum`, `Arbitrum`, `Osmosis`, `Zilliqa`, `Neo`, `Polygon`)
- `isActive` — `true` / `false`
- `search` — case-insensitive substring on symbol *or* name (LIKE wildcards in the input are escaped, so searching `50%` means the literal string)
- `sort` (`createdAt` | `symbol` | `name`) + `order` (`asc` | `desc`)
- `page` / `limit` (max 100) — response includes `pagination: { page, limit, total, totalPages }`

### Examples

```bash
# Create
curl -X POST localhost:3000/api/v1/tokens \
  -H 'content-type: application/json' \
  -d '{"symbol":"SWTH","name":"Switcheo Token","chain":"Neo","decimals":8}'

# Duplicate symbol (case-insensitive) → 409
curl -X POST localhost:3000/api/v1/tokens \
  -H 'content-type: application/json' \
  -d '{"symbol":"swth","name":"dup","chain":"Neo"}'

# List active Neo tokens
curl 'localhost:3000/api/v1/tokens?chain=Neo&isActive=true'

# Update
curl -X PATCH localhost:3000/api/v1/tokens/<id> \
  -H 'content-type: application/json' -d '{"decimals":18}'

# Delete
curl -X DELETE localhost:3000/api/v1/tokens/<id>   # 204
```

## Assumptions (declared per the challenge instructions)

- The task doesn't specify the resource — I chose a **crypto token registry** to match the domain; the layering (router → repository → db) is resource-agnostic.
- The task doesn't require auth, so none is implemented; the "production" section below covers where it would slot in.
- "Simple database" = SQLite: real SQL constraints and indexes with zero setup for the reviewer. The repository interface is the seam where Postgres would replace it.

## Design decisions

- **Validation at the boundary** — every body and query string passes through a Zod schema before touching the repository; schemas are `.strict()` so unknown keys are rejected (a typo'd field fails loudly instead of being silently ignored). Query params are validated too: `?sort=drop_table` is a `400`, not a silent default.
- **Layering** — `router` (HTTP semantics) → `repository` (SQL) → `db` (connection + migration). The app is a factory taking the DB as a dependency, so the smoke test injects `:memory:` and boots the real stack.
- **SQL safety** — every value is a bound parameter; `ORDER BY` columns come from a whitelist map, never from user text; the unique-symbol rule is enforced by the database (`UNIQUE COLLATE NOCASE`), not just application code, so it survives concurrent writers.
- **Deliberately synchronous handlers** — better-sqlite3 is a synchronous driver, which lets a plain `throw` reach the Express error middleware with no async wrappers, and removes a class of async-consistency bugs for a single-node service.
- **Consistent error contract** — one error handler translates typed `ApiError`s, malformed-JSON bodies, and unexpected exceptions into the same envelope; internals never leak to the client.
- **Operational touches** — WAL mode (readers don't block the writer), request logging with duration, `Location` header on create, graceful shutdown that checkpoints the WAL before exit, 100 kB body limit.

## What I'd add for production

1. **Auth** — API keys or JWT middleware; write operations scoped per role.
2. **Migrations** — numbered migration files (e.g. `node-pg-migrate`-style) once the schema evolves; swap SQLite for Postgres behind the same repository interface.
3. **Observability** — structured JSON logs with request IDs, `/metrics` for Prometheus.
4. **Idempotency keys** on `POST` for safe client retries.

*(An OpenAPI spec generated from the Zod schemas was originally on this list — it's now implemented: see `/docs`.)*
