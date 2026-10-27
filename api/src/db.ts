import { mkdirSync, readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';

export interface Queryable {
  query<T = any>(sql: string, params?: any[]): Promise<{ rows: T[] }>;
}
export interface Db extends Queryable {
  tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

const SCHEMA = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');

/** In-process Postgres (PGlite). dataDir undefined = memory only (tests). */
export async function createPgliteDb(dataDir?: string): Promise<Db> {
  if (dataDir) mkdirSync(dataDir, { recursive: true });
  const lite = new PGlite(dataDir);
  await lite.exec(SCHEMA);
  return {
    query: (sql, params) => lite.query(sql, params) as any,
    tx: (fn) => lite.transaction((t) => fn({ query: (s, p) => t.query(s, p) as any })),
    close: () => lite.close(),
  };
}

/** Real Postgres, e.g. Supabase's connection string. */
export async function createPgDb(connectionString: string): Promise<Db> {
  const pool = new pg.Pool({ connectionString, max: 5, ssl: connectionString.includes('localhost') ? undefined : { rejectUnauthorized: false } });
  await pool.query(SCHEMA);
  return {
    query: (sql, params) => pool.query(sql, params) as any,
    async tx(fn) {
      const c = await pool.connect();
      try {
        await c.query('BEGIN');
        const out = await fn({ query: (s, p) => c.query(s, p) as any });
        await c.query('COMMIT');
        return out;
      } catch (e) {
        await c.query('ROLLBACK');
        throw e;
      } finally {
        c.release();
      }
    },
    close: () => pool.end(),
  };
}

export async function createDbFromEnv(): Promise<Db> {
  if (process.env.DATABASE_URL) return createPgDb(process.env.DATABASE_URL);
  return createPgliteDb(process.env.PGLITE_DIR ?? './.data/pglite');
}
