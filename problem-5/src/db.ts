import Database from 'better-sqlite3';

/**
 * SQLite via better-sqlite3: zero-config persistence that still exercises
 * real SQL (constraints, indexes, transactions). The synchronous driver is
 * deliberate — for a single-node CRUD service it removes a whole class of
 * async-consistency bugs, and it benchmarks faster than the async drivers.
 *
 * DB_PATH=':memory:' gives an ephemeral database (used by the smoke tests).
 */
export function createDb(path = process.env.DB_PATH ?? 'data.db'): Database.Database {
  const db = new Database(path);
  db.pragma('journal_mode = WAL'); // readers don't block the writer
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS tokens (
      id          TEXT PRIMARY KEY,
      symbol      TEXT NOT NULL COLLATE NOCASE UNIQUE,
      name        TEXT NOT NULL,
      chain       TEXT NOT NULL,
      decimals    INTEGER NOT NULL DEFAULT 18 CHECK (decimals BETWEEN 0 AND 30),
      is_active   INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tokens_chain ON tokens (chain);
    CREATE INDEX IF NOT EXISTS idx_tokens_is_active ON tokens (is_active);
  `);

  return db;
}

export type Db = Database.Database;
