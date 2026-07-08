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
// closeIdleConnections() is required: close() alone leaves idle keep-alive
// sockets open and the callback would never fire. The unref'd timer is the
// last resort for connections that refuse to finish.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    console.log(`\n${signal} received, shutting down…`);
    server.close(() => {
      db.close();
      process.exit(0);
    });
    server.closeIdleConnections();
    setTimeout(() => {
      console.error('shutdown timed out after 10s, forcing exit');
      process.exit(1);
    }, 10_000).unref();
  });
}
