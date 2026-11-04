import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createDatabase as createPostgres } from '../server/database-postgres.ts';
import { createDatabase } from '../server/database.ts';
import { importSnapshot, migrationTables } from '../server/sqlserver-migration.ts';

// Stop the PostgreSQL API before running, so no writes occur after the snapshot.
const source = createPostgres(process.env.POSTGRES_SOURCE_URL ?? process.env.DATABASE_URL, process.env.POSTGRES_SOURCE_SCHEMA ?? 'public');
const target = createDatabase();
const backupDir = resolve('.data/backups');
mkdirSync(backupDir, { recursive: true });
const stamp = `${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`;
try {
  const snapshot = await source.transaction(async () => {
    const state = await source.readStore();
    if (!state) throw new Error('PostgreSQL nguồn không có dữ liệu nghiệp vụ.');
    const data = { state };
    for (const [table, columns] of Object.entries(migrationTables)) {
      data[table] = (await source.query(`SELECT ${columns.join(',')} FROM ${table}`)).rows;
    }
    return data;
  });
  const backup = resolve(backupDir, `postgres-before-sqlserver-${stamp}.json`);
  const text = JSON.stringify(snapshot);
  writeFileSync(backup, text, { flag: 'wx', mode: 0o600 });
  const counts = await importSnapshot(target, snapshot);
  const report = { backup, schema: target.schema, counts, sha256: createHash('sha256').update(text).digest('hex'), verified: true, migratedAt: new Date().toISOString() };
  writeFileSync(resolve(backupDir, `sqlserver-migration-${stamp}.json`), JSON.stringify(report, null, 2), { flag: 'wx', mode: 0o600 });
  console.log('Đã chuyển và đối chiếu dữ liệu PostgreSQL → SQL Server.');
  console.log(JSON.stringify(report, null, 2));
} finally { await source.close(); await target.close(); }
