import express from 'express';
import swaggerUi from 'swagger-ui-express';
import type { Db } from './db';
import { errorHandler, notFoundHandler } from './middleware/errors';
import { buildOpenApiDocument } from './openapi';
import { TokenRepository } from './tokens/repository';
import { tokensRouter } from './tokens/router';

/**
 * App factory: takes the database as a dependency so tests can inject an
 * in-memory SQLite instance and boot the whole HTTP stack in isolation.
 *
 * Handlers are synchronous on purpose (better-sqlite3 is a sync driver), so
 * a plain `throw` reaches the error middleware without async wrappers.
 */
export function createApp(db: Db): express.Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  // Minimal structured request log (method, path, status, duration).
  app.use((req, res, next) => {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(1)}ms`);
    });
    next();
  });

  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  // URL-path versioning: breaking changes ship as /api/v2 while v1 keeps
  // serving existing clients. Chosen over header versioning for visibility —
  // the version is in every log line, curl command, and bug report.
  app.use('/api/v1/tokens', tokensRouter(new TokenRepository(db)));

  // Interactive docs generated from the runtime Zod schemas — can't drift.
  const openApiDoc = buildOpenApiDocument();
  app.get('/openapi.json', (_req, res) => {
    res.json(openApiDoc);
  });
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDoc));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
