import assert from 'node:assert/strict';
import { DatabaseSync, backup } from 'node:sqlite';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createDatabase } from '../server/database-postgres.ts';

// Stop the old SQLite API before running: backup is consistent, but later writes
// to the old application would otherwise remain outside the migrated snapshot.
const sourcePath = resolve(process.argv[2] ?? '.data/quantrikpi.sqlite');
if (!existsSync(sourcePath)) throw new Error('Không tìm thấy tệp SQLite nguồn. Không khởi tạo dữ liệu mẫu thay thế.');
const backupDir = resolve('.data/backups');
mkdirSync(backupDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-') + '-' + process.pid;
const backupPath = resolve(backupDir, `quantrikpi-${stamp}.sqlite`);
const source = new DatabaseSync(sourcePath, { readOnly: true });
try { await backup(source, backupPath); } finally { source.close(); }
const snapshot = new DatabaseSync(backupPath, { readOnly: true });
const db = createDatabase();
try {
  assert.equal(snapshot.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
  const state = snapshot.prepare('SELECT json FROM state WHERE id=1').get();
  if (!state) throw new Error('SQLite không có dữ liệu nghiệp vụ.');
  const store = JSON.parse(state.json);
  const tables = {
    credentials: { columns: ['user_id', 'salt', 'hash'], key: 'user_id' },
    sessions: { columns: ['token_hash', 'user_id', 'expires'], key: 'token_hash' },
    attempts: { columns: ['key', 'count', 'until_time'], key: 'key' },
  };
  await db.initialize();
  const report = await db.transaction(async () => {
    for (const table of ['state', ...Object.keys(tables)]) {
      if ((await db.query(`SELECT 1 FROM ${table} LIMIT 1`)).rowCount) throw new Error(`Đích đã có dữ liệu (${table}). Dừng để tránh ghi đè; dùng database/schema trống.`);
    }
    await db.writeStore(store);
    assert.deepEqual(await db.readStore(), store);
    const counts = { state: 1 };
    for (const [table, { columns, key }] of Object.entries(tables)) {
      const rows = snapshot.prepare(`SELECT ${columns.join(',')} FROM ${table} ORDER BY ${key}`).all();
      for (const row of rows) {
        await db.query(`INSERT INTO ${table}(${columns.join(',')}) VALUES(${columns.map((_, i) => '$' + (i + 1)).join(',')})`, columns.map(c => row[c]));
      }
      const actual = (await db.query(`SELECT ${columns.map(c => `${c}::text AS ${c}`).join(',')} FROM ${table} ORDER BY ${key}`)).rows;
      assert.deepEqual(actual, rows.map(row => Object.fromEntries(columns.map(c => [c, String(row[c])]))));
      counts[table] = rows.length;
    }
    return { source: sourcePath, backup: backupPath, schema: process.env.DATABASE_SCHEMA ?? 'public', counts,
      stateSHA256: createHash('sha256').update(state.json).digest('hex'), verified: true, migratedAt: new Date().toISOString() };
  });
  writeFileSync(resolve(backupDir, `migration-${stamp}.json`), JSON.stringify(report, null, 2), { flag: 'wx', mode: 0o600 });
  console.log('Đã chuyển và đối chiếu toàn bộ dữ liệu SQLite → PostgreSQL.');
  console.log(JSON.stringify(report, null, 2));
} finally { snapshot.close(); await db.close(); }
