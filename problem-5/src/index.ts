import { createApp } from './app';
import { createDb } from './db';

const PORT = Number(process.env.PORT ?? 3000);

const db = createDb();
const app = createApp(db);

const server = app.listen(PORT, () => {
  console.log(`token-registry-api listening on http://localhost:${PORT}`);
});

// Graceful shutdown: stop accepting connections, then close the DB cleanly
// so the WAL is checkpointed and nothing is lost on deploy/restart.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    console.log(`\n${signal} received, shutting down…`);
    server.close(() => {
      db.close();
      process.exit(0);
    });
  });
}
