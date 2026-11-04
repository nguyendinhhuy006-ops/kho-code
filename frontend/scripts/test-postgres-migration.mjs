import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { scryptSync, createHash, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { createDatabase } from '../server/database-postgres.ts';
import { createSeed } from '../src/mocks/seed.ts';
import { enrichInitialContent } from '../src/mocks/content.ts';

mkdirSync('.data', { recursive: true });
const dir = mkdtempSync(resolve('.data/migration-test-'));
const schema = `test_migration_${Date.now()}_${process.pid}`;
const db = createDatabase(process.env.DATABASE_URL, schema);
const sourcePath = resolve(dir, 'source.sqlite');
const sqlite = new DatabaseSync(sourcePath);
sqlite.exec(`CREATE TABLE state(id INTEGER PRIMARY KEY, json TEXT NOT NULL);
  CREATE TABLE credentials(user_id TEXT PRIMARY KEY, salt TEXT NOT NULL, hash TEXT NOT NULL);
  CREATE TABLE sessions(token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires INTEGER NOT NULL);
  CREATE TABLE attempts(key TEXT PRIMARY KEY, count INTEGER NOT NULL, until_time INTEGER NOT NULL);`);
const store = enrichInitialContent(createSeed());
const password = 'Migration!2026-Long';
sqlite.prepare('INSERT INTO state VALUES(1,?)').run(JSON.stringify(store));
for (const user of store.users) {
  const salt = randomBytes(24).toString('hex');
  sqlite.prepare('INSERT INTO credentials VALUES(?,?,?)').run(user.id, salt, scryptSync(password, salt, 64).toString('hex'));
}
const token = randomBytes(32).toString('hex');
const actor = store.users.find(u => u.role === 'TDV');
sqlite.prepare('INSERT INTO sessions VALUES(?,?,?)').run(createHash('sha256').update(token).digest('hex'), actor.id, Date.now() + 3600_000);
sqlite.prepare('INSERT INTO attempts VALUES(?,?,?)').run('old-attempt', 7, Date.now() + 100_000);
sqlite.close();
const env = { ...process.env, NODE_ENV: 'test', DATABASE_SCHEMA: schema, API_DATA_DIR: dir };
async function migrate() {
  const child = spawn(process.execPath, ['scripts/migrate-sqlite-to-postgres.mjs', sourcePath], { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = ''; child.stdout.on('data', d => { output += d; }); child.stderr.on('data', d => { output += d; });
  const [code] = await once(child, 'exit');
  return { code, output };
}
let server;
try {
  let result = await migrate(); assert.equal(result.code, 0, result.output);
  assert.deepEqual(await db.readStore(), store);
  assert.equal((await db.query('SELECT count FROM attempts WHERE key=$1', ['old-attempt'])).rows[0].count, 7);
  const credentials = (await db.query('SELECT * FROM credentials ORDER BY user_id')).rows;
  result = await migrate(); assert.notEqual(result.code, 0); assert.match(result.output, /Đích đã có dữ liệu/);
  assert.deepEqual((await db.query('SELECT * FROM credentials ORDER BY user_id')).rows, credentials);
  await assert.rejects(db.transaction(async () => {
    await db.writeStore({ ...store, users: [] });
    await db.query('UPDATE credentials SET hash=$1', ['invalid']);
    throw new Error('rollback test');
  }), /rollback test/);
  assert.deepEqual(await db.readStore(), store);
  assert.deepEqual((await db.query('SELECT * FROM credentials ORDER BY user_id')).rows, credentials);
  const probe = createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening');
  const port = probe.address().port; await new Promise(r => probe.close(r));
  server = spawn(process.execPath, ['server/index.ts'], { env: { ...env, API_PORT: String(port) }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = ''; server.stdout.on('data', d => { output += d; }); server.stderr.on('data', d => { output += d; });
  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let n = 0; n < 100; n++) {
    if (server.exitCode !== null) throw new Error(output);
    try { if ((await fetch(base + '/api/health')).ok) { ready = true; break; } } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  assert.ok(ready, output);
  const existing = await fetch(base + '/api/session', { headers: { cookie: `quantrikpi_session=${token}` } });
  assert.equal(existing.status, 200); assert.equal((await existing.json()).userId, actor.id);
  const login = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: actor.email, password }) });
  assert.equal(login.status, 200); assert.ok(login.headers.get('set-cookie'));
  const original = new DatabaseSync(sourcePath, { readOnly: true });
  try { assert.deepEqual(JSON.parse(original.prepare('SELECT json FROM state').get().json), store); } finally { original.close(); }
  console.log(`PASS: migration, all rows verified, duplicate import blocked, rollback atomic, old password and existing session preserved. Retained schema: ${schema}`);
} finally {
  if (server && server.exitCode === null) { server.kill(); await once(server, 'exit'); }
  await db.close();
}
