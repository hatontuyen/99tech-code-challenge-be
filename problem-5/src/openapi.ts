import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import {
  createTokenSchema,
  listQuerySchema,
  tokenSchema,
  updateTokenSchema,
} from './tokens/schema';

extendZodWithOpenApi(z);

/**
 * The OpenAPI document is GENERATED from the same Zod schemas the app runs on:
 * request schemas validate at runtime, and `tokenSchema` is the source of the
 * repository's `Token` type — neither side of the docs can drift.
 */

const registry = new OpenAPIRegistry();

const tokenResponseSchema = tokenSchema.openapi('Token');

const errorSchema = z
  .object({
    error: z.object({
      code: z.string().openapi({ example: 'VALIDATION_ERROR' }),
      message: z.string(),
      details: z
        .array(z.object({ path: z.string(), message: z.string() }))
        .optional()
        .openapi({ description: 'Per-field issues, present on validation errors' }),
    }),
  })
  .openapi('Error');

const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: errorSchema } },
});

const idParam = z.object({ id: z.string().openapi({ description: 'Token id (UUID)' }) });

registry.registerPath({
  method: 'post',
  path: '/api/v1/tokens',
  summary: 'Create a token',
  tags: ['tokens'],
  request: {
    body: { content: { 'application/json': { schema: createTokenSchema } } },
  },
  responses: {
    201: {
      description: 'Created (Location header points at the new resource)',
      content: { 'application/json': { schema: z.object({ data: tokenResponseSchema }) } },
    },
    400: errorResponse('Validation failed'),
    409: errorResponse('Symbol already exists (case-insensitive)'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/tokens',
  summary: 'List tokens with filters, sorting, and pagination',
  tags: ['tokens'],
  request: { query: listQuerySchema },
  responses: {
    200: {
      description: 'Page of tokens',
      content: {
        'application/json': {
          schema: z.object({
            data: z.array(tokenResponseSchema),
            pagination: z.object({
              page: z.number().int(),
              limit: z.number().int(),
              total: z.number().int(),
              totalPages: z.number().int(),
            }),
          }),
        },
      },
    },
    400: errorResponse('Invalid query parameter'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/tokens/{id}',
  summary: 'Get a token',
  tags: ['tokens'],
  request: { params: idParam },
  responses: {
    200: {
      description: 'The token',
      content: { 'application/json': { schema: z.object({ data: tokenResponseSchema }) } },
    },
    404: errorResponse('Token does not exist'),
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/v1/tokens/{id}',
  summary: 'Partially update a token',
  tags: ['tokens'],
  request: {
    params: idParam,
    body: { content: { 'application/json': { schema: updateTokenSchema } } },
  },
  responses: {
    200: {
      description: 'The updated token',
      content: { 'application/json': { schema: z.object({ data: tokenResponseSchema }) } },
    },
    400: errorResponse('Validation failed or empty patch'),
    404: errorResponse('Token does not exist'),
    409: errorResponse('Symbol already exists'),
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/v1/tokens/{id}',
  summary: 'Delete a token',
  tags: ['tokens'],
  request: { params: idParam },
  responses: {
    204: { description: 'Deleted' },
    404: errorResponse('Token does not exist'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/healthz',
  summary: 'Liveness probe',
  tags: ['ops'],
  responses: {
    200: {
      description: 'Service is up',
      content: {
        'application/json': {
          schema: z.object({ status: z.literal('ok'), uptime: z.number() }),
        },
      },
    },
  },
});

export function buildOpenApiDocument() {
  return new OpenApiGeneratorV3(registry.definitions).generateDocument({
    openapi: '3.0.3',
    info: {
      title: 'Token Registry API',
      version: '1.0.0',
      description:
        'CRUD API for a crypto token registry. This document is generated from the Zod schemas that validate requests at runtime.',
    },
    servers: [{ url: '/', description: 'This server' }],
  });
}
