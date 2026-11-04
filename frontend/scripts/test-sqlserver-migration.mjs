import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes, scryptSync, createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { createDatabase as createPostgres } from '../server/database-postgres.ts';
import { createDatabase } from '../server/database.ts';
import { importSnapshot, migrationTables, normalizedRows } from '../server/sqlserver-migration.ts';
import { createSeed } from '../src/mocks/seed.ts';
import { enrichInitialContent } from '../src/mocks/content.ts';

const id = `${Date.now()}_${process.pid}`;
const schema = `test_migration_${id}`;
const source = createPostgres(undefined, `test_source_${id}`);
const target = createDatabase(undefined, schema);
mkdirSync('.data', { recursive: true });
const dataDir = mkdtempSync(resolve('.data/sqlserver-migration-'));
const store = enrichInitialContent(createSeed());
const actor = store.users.find(u => u.role === 'TDV');
const password = 'Migration!2026-Long';
const token = randomBytes(32).toString('hex');
let server;
try {
  await source.initialize();
  await source.transaction(async () => {
    await source.writeStore(store);
    for (const user of store.users) {
      const salt = randomBytes(24).toString('hex');
      await source.query('INSERT INTO credentials(user_id,salt,hash) VALUES($1,$2,$3)', [user.id, salt, scryptSync(password, salt, 64).toString('hex')]);
    }
    await source.query('INSERT INTO sessions(token_hash,user_id,expires) VALUES($1,$2,$3)', [createHash('sha256').update(token).digest('hex'), actor.id, Date.now() + 3600_000]);
    await source.query('INSERT INTO attempts(key,count,until_time) VALUES($1,$2,$3)', ['old-attempt', 7, Date.now() + 100_000]);
  });
  const snapshot = await source.transaction(async () => {
    const value = { state: await source.readStore() };
    for (const [table, columns] of Object.entries(migrationTables)) value[table] = (await source.query(`SELECT ${columns.join(',')} FROM ${table}`)).rows;
    return value;
  });
  const counts = await importSnapshot(target, snapshot);
  assert.deepEqual(counts, { state: 1, credentials: store.users.length, sessions: 1, attempts: 1 });
  assert.deepEqual(await target.readStore(), store);
  await assert.rejects(importSnapshot(target, snapshot), /Đích đã có dữ liệu/);
  await assert.rejects(target.transaction(async () => {
    await target.writeStore({ ...store, users: [] });
    await target.query('UPDATE {{credentials}} SET hash=@arg1', ['invalid']);
    throw new Error('rollback test');
  }), /rollback test/);
  assert.deepEqual(await target.readStore(), store);
  assert.deepEqual(normalizedRows((await target.query('SELECT * FROM {{credentials}}')).rows), normalizedRows(snapshot.credentials));
  // Fail after state/credentials have been inserted: the import must roll back all of them.
  const broken = createDatabase(undefined, `test_broken_${id}`);
  try {
    await assert.rejects(importSnapshot(broken, { ...snapshot, sessions: [{ ...snapshot.sessions[0], expires: 'invalid-integer' }] }));
    assert.equal(await broken.readStore(), undefined);
    assert.equal((await broken.query('SELECT * FROM {{credentials}}')).rowCount, 0);
  } finally { await broken.close(); }
  const probe = createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening');
  const port = probe.address().port; await new Promise(r => probe.close(r));
  server = spawn(process.execPath, ['server/index.ts'], { env: { ...process.env, NODE_ENV: 'test', DATABASE_SCHEMA: schema, API_DATA_DIR: dataDir, API_PORT: String(port) }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = ''; server.stdout.on('data', d => { output += d; }); server.stderr.on('data', d => { output += d; });
  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let n = 0; n < 100; n++) {
    if (server.exitCode !== null) throw new Error(output);
    try { if ((await fetch(base + '/api/health')).ok) { ready = true; break; } } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  assert.ok(ready, output);
  const session = await fetch(base + '/api/session', { headers: { cookie: `quantrikpi_session=${token}` } });
  assert.equal(session.status, 200); assert.equal((await session.json()).userId, actor.id);
  const login = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: actor.email, password }) });
  assert.equal(login.status, 200); assert.ok(login.headers.get('set-cookie'));
  assert.deepEqual(await source.readStore(), store);
  console.log(`PASS: PostgreSQL → SQL Server, all rows and Unicode verified, duplicate import blocked, partial import rolled back, password and session preserved. Schema ${schema}`);
} finally {
  if (server && server.exitCode === null) { server.kill(); await once(server, 'exit'); }
  await source.close(); await target.close();
}
