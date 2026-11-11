import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { relationalStore, quote, entities } from './relational-store.ts';
import { normalizedRows } from './sqlserver-migration.ts';
import type { createDatabase } from './database-sqlserver.ts';

export const legacyTables = ['DonVi', 'TaiKhoan', 'ChienLuoc', 'MucTieu', 'KeHoach', 'NhiemVu', 'PhanCong', 'TienDo', 'KPI', 'DanhGiaKPI', 'ThongBao'];
type Database = ReturnType<typeof createDatabase>;
const normalize = (value: unknown) => JSON.parse(JSON.stringify(value));
export async function migrateToRelational(db: Database, options: {
  targetSchema: string; archiveSchema: string; backupDirectory: string;
  archiveTables?: string[]; failBeforeCommit?: boolean;
}) {
  const { targetSchema, archiveSchema, backupDirectory, archiveTables = [] } = options;
  for (const name of [targetSchema, archiveSchema]) if (!/^[a-z][a-z0-9_]{0,62}$/.test(name)) throw new Error('Invalid schema.');
  if (new Set([targetSchema, archiveSchema, db.schema]).size !== 3) throw new Error('Schemas must be distinct.');
  if (/^(test_|e2e_)/.test(db.schema) && ![targetSchema, archiveSchema].every(name => /^(test_|e2e_)/.test(name))) throw new Error('Tests cannot target production schemas.');
  if ((await db.storageInfo()).mode !== 'json') throw new Error('Relational migration already applied.');
  mkdirSync(backupDirectory, { recursive: true });
  const tag = `${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}`;
  const backupPath = join(backupDirectory, `before-relational-${tag}.json`);
  const storage = relationalStore(db.query, targetSchema);
  try {
    return await db.transaction(async () => {
      if ((await db.query('SELECT 1 AS found FROM sys.schemas WHERE name=@arg1', [archiveSchema])).rowCount) throw new Error('Archive schema already exists.');
      const targetTables = (await db.query(`SELECT t.name FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id WHERE s.name=@arg1`, [targetSchema])).rows.map(row => row.name);
      const expected = new Set(archiveTables);
      if (targetTables.some(name => name !== 'sysdiagrams' && !expected.has(name)) || archiveTables.some(name => !targetTables.includes(name))) {
        throw new Error('Unexpected target tables; refusing to overwrite.');
      }
      for (const name of archiveTables) if (!legacyTables.includes(name)) throw new Error('Not an approved legacy table.');
      const source = await db.readStore();
      if (!source) throw new Error('No source store.');
      const credentials = (await db.query('SELECT * FROM {{credentials}}')).rows;
      const sessions = (await db.query('SELECT * FROM {{sessions}}')).rows;
      const attempts = (await db.query('SELECT * FROM {{attempts}}')).rows;
      const legacy: Record<string, Record<string, unknown>[]> = {};
      for (const name of archiveTables) legacy[name] = (await db.query(`SELECT * FROM ${quote(targetSchema)}.${quote(name)}`)).rows;
      writeFileSync(backupPath, JSON.stringify({ state: source, credentials, sessions, attempts, legacy }, null, 2), { flag: 'wx', mode: 0o600 });
      await db.query(`CREATE SCHEMA ${quote(archiveSchema)} AUTHORIZATION dbo`);
      for (const name of archiveTables) await db.query(`ALTER SCHEMA ${quote(archiveSchema)} TRANSFER ${quote(targetSchema)}.${quote(name)}`);
      await storage.initialize();
      await storage.write(source);
      assert.deepEqual(normalize(await storage.read()), normalize(source));
      for (const row of credentials) await db.query(`INSERT INTO ${storage.table('ThongTinDangNhap')} ([user_id],[salt],[hash]) VALUES(@arg1,@arg2,@arg3)`, [row.user_id, row.salt, row.hash]);
      assert.deepEqual(normalizedRows((await db.query(`SELECT * FROM ${storage.table('ThongTinDangNhap')}`)).rows), normalizedRows(credentials));
      for (const name of archiveTables) assert.deepEqual(normalizedRows((await db.query(`SELECT * FROM ${quote(archiveSchema)}.${quote(name)}`)).rows), normalizedRows(legacy[name]));
      await db.query(`CREATE TABLE [${db.schema}].[storage_config] (id int PRIMARY KEY CHECK(id=1), target_schema nvarchar(128) NOT NULL);
        INSERT INTO [${db.schema}].[storage_config] VALUES(1,@arg1)`, [targetSchema]);
      for (const name of ['state', 'credentials']) await db.query(`ALTER SCHEMA ${quote(archiveSchema)} TRANSFER [${db.schema}].${quote(name)}`);
      await db.refreshStorage();
      assert.deepEqual(normalize(await db.readStore()), normalize(source));
      assert.deepEqual(normalizedRows((await db.query('SELECT * FROM {{credentials}}')).rows), normalizedRows(credentials));
      assert.deepEqual(normalizedRows((await db.query('SELECT * FROM {{sessions}}')).rows), normalizedRows(sessions));
      assert.deepEqual(normalizedRows((await db.query('SELECT * FROM {{attempts}}')).rows), normalizedRows(attempts));
      if (options.failBeforeCommit) throw new Error('Injected migration failure');
      const report = { targetSchema, archiveSchema, backupPath, archivedTables: archiveTables,
        counts: Object.fromEntries(entities.map(entity => [entity.table, (source[entity.key] as unknown[]).length])),
        credentials: credentials.length, sessions: sessions.length, attempts: attempts.length, verified: true };
      writeFileSync(join(backupDirectory, `relational-report-${tag}.json`), JSON.stringify(report, null, 2), { flag: 'wx' });
      return report;
    });
  } catch (error) { await db.refreshStorage(); throw error; }
}
