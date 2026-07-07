import { Router } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../middleware/errors';
import { DuplicateSymbolError, TokenRepository } from './repository';
import { createTokenSchema, listQuerySchema, updateTokenSchema } from './schema';

function parse<T>(schema: { parse: (v: unknown) => T }, value: unknown): T {
  try {
    return schema.parse(value);
  } catch (err) {
    if (err instanceof ZodError) {
      throw ApiError.badRequest(
        'Request validation failed',
        err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      );
    }
    throw err;
  }
}

export function tokensRouter(repo: TokenRepository): Router {
  const router = Router();

  // Create
  router.post('/', (req, res) => {
    const input = parse(createTokenSchema, req.body);
    try {
      const token = repo.create(input);
      res.status(201).location(`/api/tokens/${token.id}`).json({ data: token });
    } catch (err) {
      if (err instanceof DuplicateSymbolError) throw ApiError.conflict(err.message);
      throw err;
    }
  });

  // List with filters + pagination
  router.get('/', (req, res) => {
    const query = parse(listQuerySchema, req.query);
    const { data, total } = repo.list(query);
    res.json({
      data,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    });
  });

  // Get one
  router.get('/:id', (req, res) => {
    const token = repo.findById(req.params.id);
    if (!token) throw ApiError.notFound('token', req.params.id);
    res.json({ data: token });
  });

  // Partial update
  router.patch('/:id', (req, res) => {
    const input = parse(updateTokenSchema, req.body);
    try {
      const token = repo.update(req.params.id, input);
      if (!token) throw ApiError.notFound('token', req.params.id);
      res.json({ data: token });
    } catch (err) {
      if (err instanceof DuplicateSymbolError) throw ApiError.conflict(err.message);
      throw err;
    }
  });

  // Delete
  router.delete('/:id', (req, res) => {
    if (!repo.delete(req.params.id)) throw ApiError.notFound('token', req.params.id);
    res.status(204).end();
  });

  return router;
}
