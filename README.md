# 99Tech Code Challenge — Backend

| Problem | Solution | Highlights |
|---|---|---|
| [Problem 4](./problem-4) — Three ways to sum to n (TS) | `sum_to_n.ts` + test suite | O(1) closed form, O(n) oracle, stack-safe O(log n)-depth recursion; complexity commented per function; handles *any* integer incl. negatives; 500 randomized cross-checks |
| [Problem 5](./problem-5) — ExpressJS CRUD server | Express + strict TS + SQLite | Domain-aligned resource (crypto token registry), Zod validation at the boundary, filters/pagination/sorting with SQL-injection-safe whitelists, consistent error contract, DB-enforced uniqueness, graceful shutdown. End-to-end smoke test covers every endpoint incl. 400/404/409 paths |
| [Problem 6](./problem-6) — Live scoreboard spec | Architecture specification | Single-use signed action tokens (client never sends points), Redis ZSET leaderboard + append-only Postgres ledger, WebSocket fan-out via pub/sub, explicit threat-model table, mermaid + ASCII sequence diagrams, ops/reconciliation plan, improvement recommendations |

## Quick start

```bash
# Problem 4
cd problem-4 && npx tsx sum_to_n.test.ts

# Problem 5
cd problem-5 && npm install && npm run smoke   # full E2E verification
npm run dev                                    # live server on :3000

# Problem 6
open problem-6/README.md
```
