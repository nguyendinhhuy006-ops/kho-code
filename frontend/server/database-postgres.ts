import { AsyncLocalStorage } from 'node:async_hooks';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
import { Pool, type PoolClient } from 'pg';

const envPath = resolve('.env.local');
if (existsSync(envPath)) loadEnvFile(envPath);

export const schemaSQL = `
  CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY CHECK (id=1), json JSONB NOT NULL);
  CREATE TABLE IF NOT EXISTS credentials (user_id TEXT PRIMARY KEY, salt TEXT NOT NULL, hash TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires BIGINT NOT NULL);
  CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions(expires);
  CREATE TABLE IF NOT EXISTS attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, until_time BIGINT NOT NULL);
`;

export function createDatabase(connectionString = process.env.DATABASE_URL, schema = process.env.DATABASE_SCHEMA ?? 'public') {
  if (!connectionString) throw new Error('Thiếu DATABASE_URL. Xem server/POSTGRESQL.md để cấu hình PostgreSQL.');
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(schema)) throw new Error('DATABASE_SCHEMA không hợp lệ.');
  if (process.env.NODE_ENV === 'test' && !/^(test_|e2e_)/.test(schema)) throw new Error('Kiểm thử phải dùng schema test_ hoặc e2e_ riêng.');
  const pool = new Pool({ connectionString, max: 10, connectionTimeoutMillis: 5_000,
    options: `-c search_path=${schema} -c statement_timeout=15000 -c idle_in_transaction_session_timeout=30000` });
  pool.on('error', () => console.error('Kết nối PostgreSQL nhàn rỗi gặp lỗi.'));
  const context = new AsyncLocalStorage<PoolClient>();
  async function query(sql: string, values: unknown[] = []) {
    return (context.getStore() ?? pool).query(sql, values);
  }
  return {
    query,
    async initialize() {
      await pool.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
      await this.transaction(async () => { await query(schemaSQL); });
    },
    async readStore() {
      // JSON text preserves the existing domain representation; PostgreSQL stores JSONB.
      const result = await query('SELECT json::text AS json FROM state WHERE id=1');
      return result.rows[0] ? JSON.parse(result.rows[0].json) : undefined;
    },
    async writeStore(value: unknown) {
      await query('INSERT INTO state(id,json) VALUES(1,$1::jsonb) ON CONFLICT(id) DO UPDATE SET json=excluded.json', [JSON.stringify(value)]);
    },
    async transaction<T>(work: () => Promise<T>): Promise<T> {
      if (context.getStore()) return work();
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        // All API workers and migration share this lock. The legacy domain updates
        // the entire document, so reading and writing must be serialized together.
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended(current_database() || current_schema(), 0))');
        const result = await context.run(client, work);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      } finally { client.release(); }
    },
    close: () => pool.end(),
  };
}
