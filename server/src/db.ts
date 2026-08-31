/**
 * Postgres pool.
 *
 * Everything that must be atomic goes through `tx`, which rolls back on any throw. The
 * booking path in particular has to be one transaction: the hold is consumed and the
 * booking inserted together, or neither happens.
 */
import pg from 'pg';

const { Pool } = pg;

/**
 * Money is stored in whole rupees as INTEGER, but `NUMERIC` columns come back as strings
 * to preserve precision. `rating` is the only one, and a JS number is exact for a single
 * decimal, so it is parsed here rather than at every call site.
 */
pg.types.setTypeParser(1700, (value) => (value === null ? null : Number(value)));

export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ?? `postgresql://localhost:5432/${process.env.PGDATABASE ?? 'maidan'}`,
  max: 10,
});

export type Db = pg.PoolClient;

/** Runs `work` inside a transaction, rolling back if it throws. */
export async function tx<T>(work: (client: Db) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/** Postgres error codes the API turns into specific client errors rather than a 500. */
export const PG = {
  UNIQUE_VIOLATION: '23505',
  EXCLUSION_VIOLATION: '23P01',
} as const;

export function isPgError(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}
