import { randomUUID } from 'node:crypto';
import type { Db } from '../db';
import type { CreateTokenInput, ListQuery, Token, UpdateTokenInput } from './schema';

interface TokenRow {
  id: string;
  symbol: string;
  name: string;
  chain: Token['chain'];
  decimals: number;
  is_active: 0 | 1;
  created_at: string;
  updated_at: string;
}

const toToken = (row: TokenRow): Token => ({
  id: row.id,
  symbol: row.symbol,
  name: row.name,
  chain: row.chain,
  decimals: row.decimals,
  isActive: row.is_active === 1,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/** Whitelist mapping for ORDER BY — user input never reaches SQL as text. */
const SORT_COLUMNS: Record<ListQuery['sort'], string> = {
  createdAt: 'created_at',
  symbol: 'symbol',
  name: 'name',
};

export class DuplicateSymbolError extends Error {}

export class TokenRepository {
  constructor(private readonly db: Db) {}

  create(input: CreateTokenInput): Token {
    const now = new Date().toISOString();
    const row: TokenRow = {
      id: randomUUID(),
      symbol: input.symbol,
      name: input.name,
      chain: input.chain,
      decimals: input.decimals,
      is_active: input.isActive ? 1 : 0,
      created_at: now,
      updated_at: now,
    };
    try {
      this.db
        .prepare(
          `INSERT INTO tokens (id, symbol, name, chain, decimals, is_active, created_at, updated_at)
           VALUES (@id, @symbol, @name, @chain, @decimals, @is_active, @created_at, @updated_at)`,
        )
        .run(row);
    } catch (err) {
      if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
        throw new DuplicateSymbolError(`symbol '${input.symbol}' already exists`);
      }
      throw err;
    }
    return toToken(row);
  }

  findById(id: string): Token | undefined {
    const row = this.db.prepare('SELECT * FROM tokens WHERE id = ?').get(id) as
      | TokenRow
      | undefined;
    return row ? toToken(row) : undefined;
  }

  list(query: ListQuery): { data: Token[]; total: number } {
    const where: string[] = [];
    const params: Record<string, unknown> = {};

    if (query.chain) {
      where.push('chain = @chain');
      params.chain = query.chain;
    }
    if (query.isActive !== undefined) {
      where.push('is_active = @isActive');
      params.isActive = query.isActive ? 1 : 0;
    }
    if (query.search) {
      where.push("(symbol LIKE @search ESCAPE '\\' OR name LIKE @search ESCAPE '\\')");
      // Escape LIKE wildcards so a search for "50%" means the literal string.
      params.search = `%${query.search.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const orderSql = `ORDER BY ${SORT_COLUMNS[query.sort]} ${query.order.toUpperCase()}`;
    const offset = (query.page - 1) * query.limit;

    const total = (
      this.db.prepare(`SELECT COUNT(*) AS c FROM tokens ${whereClause}`).get(params) as {
        c: number;
      }
    ).c;

    const rows = this.db
      .prepare(`SELECT * FROM tokens ${whereClause} ${orderSql} LIMIT @limit OFFSET @offset`)
      .all({ ...params, limit: query.limit, offset }) as TokenRow[];

    return { data: rows.map(toToken), total };
  }

  update(id: string, input: UpdateTokenInput): Token | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;

    const next = {
      symbol: input.symbol ?? existing.symbol,
      name: input.name ?? existing.name,
      chain: input.chain ?? existing.chain,
      decimals: input.decimals ?? existing.decimals,
      is_active: (input.isActive ?? existing.isActive) ? 1 : 0,
      updated_at: new Date().toISOString(),
      id,
    };

    try {
      this.db
        .prepare(
          `UPDATE tokens
           SET symbol = @symbol, name = @name, chain = @chain,
               decimals = @decimals, is_active = @is_active, updated_at = @updated_at
           WHERE id = @id`,
        )
        .run(next);
    } catch (err) {
      if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
        throw new DuplicateSymbolError(`symbol '${input.symbol}' already exists`);
      }
      throw err;
    }
    return this.findById(id);
  }

  delete(id: string): boolean {
    return this.db.prepare('DELETE FROM tokens WHERE id = ?').run(id).changes > 0;
  }
}
