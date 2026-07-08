import { z } from 'zod';

/**
 * Validation lives at the boundary: nothing un-validated crosses into the
 * repository. Zod gives runtime enforcement *and* the static types — one
 * source of truth, no drift.
 */

export const CHAINS = ['Ethereum', 'Arbitrum', 'Osmosis', 'Zilliqa', 'Neo', 'Polygon'] as const;

const symbol = z
  .string()
  .trim()
  .min(1)
  .max(16)
  .regex(/^[A-Za-z0-9]+$/, 'symbol must be alphanumeric');

export const createTokenSchema = z
  .object({
    symbol,
    name: z.string().trim().min(1).max(80),
    chain: z.enum(CHAINS),
    decimals: z.number().int().min(0).max(30).default(18),
    isActive: z.boolean().default(true),
  })
  .strict(); // unknown keys are rejected, not silently dropped

// Partial update (PATCH semantics); at least one known field required.
export const updateTokenSchema = createTokenSchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    message: 'provide at least one field to update',
  });

export const listQuerySchema = z.object({
  chain: z.enum(CHAINS).optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  /** Case-insensitive substring match on symbol or name. */
  search: z.string().trim().min(1).max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['createdAt', 'symbol', 'name']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export type CreateTokenInput = z.infer<typeof createTokenSchema>;
export type UpdateTokenInput = z.infer<typeof updateTokenSchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;

// Single source of truth for the response shape: the repository's return type
// AND the OpenAPI Token schema both derive from this, so they cannot drift.
export const tokenSchema = z.object({
  id: z.string().uuid(),
  symbol: z.string(),
  name: z.string(),
  chain: z.enum(CHAINS),
  decimals: z.number().int(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Token = z.infer<typeof tokenSchema>;
