import type { NextFunction, Request, Response } from 'express';

/** Typed operational error: thrown by handlers, translated by the middleware. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }

  static notFound(what: string, id: string) {
    return new ApiError(404, 'NOT_FOUND', `${what} '${id}' does not exist`);
  }

  static conflict(message: string) {
    return new ApiError(409, 'CONFLICT', message);
  }

  static badRequest(message: string, details?: unknown) {
    return new ApiError(400, 'VALIDATION_ERROR', message, details);
  }
}

/**
 * Single choke point for the error contract. Every failure — expected or not —
 * leaves the API in the same envelope: { error: { code, message, details? } }.
 * Unexpected errors are logged with a stack but never leak internals to the
 * client.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ApiError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  // Malformed JSON body from express.json()
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' },
    });
    return;
  }

  console.error('[unhandled]', err);
  res.status(500).json({
    error: { code: 'INTERNAL', message: 'Internal server error' },
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: { code: 'ROUTE_NOT_FOUND', message: `No route for ${req.method} ${req.path}` },
  });
}
