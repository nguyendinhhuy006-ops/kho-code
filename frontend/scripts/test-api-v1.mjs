import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { createDatabase } from '../server/database.ts';

// Retain the isolated database for inspection; never touch the application database.
mkdirSync(resolve('.data'), { recursive: true });
const dataDir = mkdtempSync(resolve('.data/api-v1-'));
const schema = `test_api_${Date.now()}_${process.pid}`;
const probe = createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening');
const port = probe.address().port; await new Promise(r => probe.close(r));
const child = spawn(process.execPath, ['server/index.ts'], { env: { ...process.env, NODE_ENV: 'test', DATABASE_SCHEMA: schema, API_PORT: String(port), API_DATA_DIR: dataDir }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let output = ''; child.stdout.on('data', d => { output += d; }); child.stderr.on('data', d => { output += d; });
let second;
const base = `http://127.0.0.1:${port}`;
async function request(path, cookie, method = 'GET', input) {
  const response = await fetch(base + path, { method, headers: { ...(cookie ? { cookie } : {}), ...(input ? { 'Content-Type': 'application/json' } : {}) }, body: input ? JSON.stringify(input) : undefined });
  return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0], requestId: response.headers.get('x-request-id') };
}
try {
  let ready = false;
  for (let n = 0; n < 100; n++) {
    if (child.exitCode !== null) throw new Error(output);
    try { if ((await fetch(base + '/api/health')).ok) { ready = true; break; } } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  assert.ok(ready, output);
  assert.equal((await request('/api/v1/plans')).status, 401);
  const login = async email => { const r = await request('/api/auth/login', null, 'POST', { email, password: 'KiemThu!2026-Long' }); assert.equal(r.status, 200); return r.cookie; };
  const tdv = await login('tdv@quantrikpi.local'); const bgh = await login('bgh@quantrikpi.local'); const other = await login('tdv.kt@quantrikpi.local');
  assert.equal((await request('/api/v1/me', tdv)).body.user.role, 'TDV');
  const list = await request('/api/v1/plans?pageSize=1', tdv);
  assert.equal(list.status, 200); assert.equal(list.body.items.length, 1); assert.ok(list.body.total > 1);
  assert.equal((await request('/api/v1/plans?pageSize=101', tdv)).status, 422);
  assert.equal((await request('/api/v1/plans/p3', tdv)).status, 404);
  const created = await request('/api/v1/plans', tdv, 'POST', { title: 'API v1 integration', yearId: '2026', objective: 'Kiểm chứng API', deliverables: 'Biên bản', startDate: '2026-11-01', endDate: '2026-12-01', unitId: 'kt', status: 'approved' });
  assert.equal(created.status, 200);
  const plan = created.body.data.plans.find(p => p.title === 'API v1 integration');
  assert.equal(plan.status, 'draft'); assert.equal(plan.unitId, 'cntt');
  assert.equal((await request(`/api/v1/plans/${plan.id}`, other)).status, 404);
  const path = `/api/v1/plans/${plan.id}`;
  let version = (await request(path, tdv)).body.item.version;
  assert.equal((await request(path, tdv, 'PATCH', { title: 'Missing version' })).status, 422);
  const results = await Promise.all(['First update', 'Second update'].map(title => request(path, tdv, 'PATCH', { version, title })));
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
  const conflict = results.find(r => r.status === 409); assert.equal(conflict.body.code, 'VERSION_CONFLICT'); assert.equal(conflict.body.requestId, conflict.requestId);
  version = (await request(path, tdv)).body.item.version;
  assert.equal((await request(path + '/review', bgh, 'POST', { version, approved: 'false' })).status, 422);
  assert.equal((await request(path + '/submit', tdv, 'POST', { version })).status, 200);
  version = (await request(path, bgh)).body.item.version;
  assert.equal((await request(path + '/review', tdv, 'POST', { version, approved: true })).status, 403);
  assert.equal((await request(path + '/review', bgh, 'POST', { version, approved: true })).status, 200);
  assert.equal((await request(path, tdv)).body.item.status, 'approved');
  const legacy = await request('/api/session', tdv); assert.equal(legacy.status, 200);
  assert.ok(legacy.body.data.logs.some(l => l.entityId === plan.id && l.action === 'plan.review'));
  // Two API processes must share a lock in SQL Server, not an in-memory mutex.
  const otherProbe = createServer(); otherProbe.listen(0, '127.0.0.1'); await once(otherProbe, 'listening');
  const otherPort = otherProbe.address().port; await new Promise(r => otherProbe.close(r));
  second = spawn(process.execPath, ['server/index.ts'], { env: { ...process.env, NODE_ENV: 'test', DATABASE_SCHEMA: schema, API_PORT: String(otherPort), API_DATA_DIR: dataDir }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  second.stdout.on('data', d => { output += d; }); second.stderr.on('data', d => { output += d; });
  let secondReady = false;
  for (let n = 0; n < 100; n++) {
    if (second.exitCode !== null) throw new Error(output);
    try { if ((await fetch(`http://127.0.0.1:${otherPort}/api/health`)).ok) { secondReady = true; break; } } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  assert.ok(secondReady, output);
  const draftResult = await request('/api/v1/plans', tdv, 'POST', { title: 'Cross worker', yearId: '2026' });
  const draft = draftResult.body.data.plans.find(p => p.title === 'Cross worker');
  const draftPath = `/api/v1/plans/${draft.id}`;
  version = (await request(draftPath, tdv)).body.item.version;
  const concurrent = await Promise.all([
    request(draftPath, tdv, 'PATCH', { version, title: 'Worker one' }),
    fetch(`http://127.0.0.1:${otherPort}${draftPath}`, { method: 'PATCH', headers: { cookie: tdv, 'Content-Type': 'application/json' }, body: JSON.stringify({ version, title: 'Worker two' }) }),
  ]);
  assert.deepEqual(concurrent.map(r => r.status).sort(), [200, 409]);
  // A failed login returns 401 but must commit the throttle counters.
  for (let n = 0; n < 10; n++) assert.equal((await request('/api/auth/login', null, 'POST', { email: 'missing@quantrikpi.local', password: 'wrong-password' })).status, 401);
  assert.equal((await request('/api/auth/login', null, 'POST', { email: 'missing@quantrikpi.local', password: 'wrong-password' })).status, 429);
  const db = createDatabase(undefined, schema);
  try { assert.ok((await db.query('SELECT count FROM {{attempts}} WHERE count=10')).rowCount >= 2); } finally { await db.close(); }
  console.log('API v1: PASS — auth, scope, pagination, validation, mass assignment, concurrent updates, workflow, audit and legacy compatibility.');
  console.log(`Retained test database: ${dataDir}`);
  console.log(`Retained SQL Server schema: ${schema}`);
} finally {
  if (second && second.exitCode === null) { second.kill(); await once(second, 'exit'); }
  child.kill();
  if (child.exitCode === null) await once(child, 'exit');
}
