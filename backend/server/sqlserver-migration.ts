import assert from 'node:assert/strict';
import type { createDatabase } from './database-sqlserver.ts';

export const migrationTables = {
  credentials: ['user_id', 'salt', 'hash'],
  sessions: ['token_hash', 'user_id', 'expires'],
  attempts: ['key', 'count', 'until_time'],
} as const;
export type DatabaseSnapshot = {
  state: unknown;
  credentials: Record<string, unknown>[];
  sessions: Record<string, unknown>[];
  attempts: Record<string, unknown>[];
};
export function normalizedRows(rows: Record<string, unknown>[]) {
  return rows.map(row => Object.fromEntries(Object.entries(row).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => [key, String(value)])))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b), 'en'));
}
export async function importSnapshot(db: ReturnType<typeof createDatabase>, snapshot: DatabaseSnapshot) {
  if (!snapshot.state || typeof snapshot.state !== 'object') throw new Error('Không có dữ liệu nghiệp vụ để chuyển.');
  await db.initialize();
  return db.transaction(async () => {
    for (const table of ['state', ...Object.keys(migrationTables)]) {
      if ((await db.query(`SELECT TOP(1) 1 AS found FROM ${db.table(table)}`)).rowCount) {
        throw new Error(`Đích đã có dữ liệu (${table}); dừng để tránh ghi đè.`);
      }
    }
    await db.writeStore(snapshot.state);
    assert.deepEqual(await db.readStore(), snapshot.state);
    const counts: Record<string, number> = { state: 1 };
    for (const [name, columns] of Object.entries(migrationTables)) {
      const rows = snapshot[name as keyof typeof migrationTables];
      for (const row of rows) {
        await db.query(`INSERT INTO ${db.table(name)}(${columns.map(c => `[${c}]`).join(',')}) VALUES(${columns.map((_, i) => `@arg${i + 1}`).join(',')})`, columns.map(c => row[c]));
      }
      const actual = (await db.query(`SELECT ${columns.map(c => `[${c}]`).join(',')} FROM ${db.table(name)}`)).rows;
      assert.deepEqual(normalizedRows(actual), normalizedRows(rows));
      counts[name] = rows.length;
    }
    return counts;
  });
}
