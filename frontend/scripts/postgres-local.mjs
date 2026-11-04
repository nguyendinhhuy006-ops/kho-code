import { existsSync, mkdirSync, readFileSync, writeFileSync, openSync, closeSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import pg from 'pg';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));
if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('Công cụ local dành cho Windows x64; máy khác dùng PostgreSQL riêng và DATABASE_URL.');
const { initdb, pg_ctl } = await import('@embedded-postgres/windows-x64');
const root = resolve('.data');
const cluster = resolve(root, 'postgres');
const configPath = resolve(root, 'postgres-local.json');
mkdirSync(root, { recursive: true });
let config;
if (existsSync(configPath)) config = JSON.parse(readFileSync(configPath, 'utf8'));
else {
  config = { port: 55432, adminPassword: randomBytes(30).toString('hex'), password: randomBytes(30).toString('hex') };
  writeFileSync(configPath, JSON.stringify(config), { flag: 'wx', mode: 0o600 });
}
function run(binary, args, allowFailure = false) {
  // PostgreSQL children inherit output handles on Windows. A file avoids leaving
  // spawnSync waiting for a pipe held open by the background server.
  const logPath = resolve(root, `postgres-command-${Date.now()}-${randomBytes(3).toString('hex')}.log`);
  const log = openSync(logPath, 'wx');
  let result;
  try {
  result = spawnSync(binary, args, { windowsHide: true, stdio: ['ignore', log, log], timeout: 60_000,
    env: { ...process.env, PATH: `${dirname(binary)};${process.env.PATH}` } });
  } finally { closeSync(log); }
  if (result.error) throw result.error;
  if (result.status && !allowFailure) throw new Error(readFileSync(logPath, 'utf8') || `PostgreSQL exit ${result.status}`);
  return result;
}
const command = process.argv[2] ?? 'start';
if (command === 'stop') {
  run(pg_ctl, ['-D', cluster, '-m', 'fast', '-w', 'stop']);
  console.log('Đã dừng PostgreSQL local. Dữ liệu được giữ nguyên.');
  process.exit(0);
}
if (command !== 'start') throw new Error('Dùng postgres-local.mjs start hoặc stop.');
if (!existsSync(resolve(cluster, 'PG_VERSION'))) {
  const passwordFile = resolve(root, 'postgres-init-password.txt');
  if (!existsSync(passwordFile)) writeFileSync(passwordFile, config.adminPassword, { flag: 'wx', mode: 0o600 });
  run(initdb, ['-D', cluster, '-U', 'postgres', '--pwfile', passwordFile, '--auth=scram-sha-256', '--encoding=UTF8', '--locale=C']);
}
async function isRunning() {
  const probe = new pg.Client({ host: '127.0.0.1', port: config.port, user: 'postgres', password: config.adminPassword, database: 'postgres', connectionTimeoutMillis: 2_000 });
  try { await probe.connect(); await probe.query('SELECT 1'); return true; }
  catch { return false; }
  finally { await probe.end().catch(() => {}); }
}
if (!await isRunning()) {
  run(pg_ctl, ['-D', cluster, '-l', resolve(root, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${config.port}`, '-w', 'start']);
}
const admin = new pg.Client({ host: '127.0.0.1', port: config.port, user: 'postgres', password: config.adminPassword, database: 'postgres', connectionTimeoutMillis: 5_000 });
await admin.connect();
try {
  if (!(await admin.query("SELECT 1 FROM pg_roles WHERE rolname='quantrikpi'")).rowCount) {
    // The password is generated locally as hexadecimal, never user-supplied SQL.
    await admin.query(`CREATE ROLE quantrikpi LOGIN PASSWORD '${config.password}'`);
  }
  if (!(await admin.query("SELECT 1 FROM pg_database WHERE datname='quantrikpi'")).rowCount) {
    await admin.query('CREATE DATABASE quantrikpi OWNER quantrikpi');
  }
} finally { await admin.end(); }
const envPath = resolve('.env.local');
if (!existsSync(envPath)) writeFileSync(envPath, `DATABASE_URL=postgresql://quantrikpi:${config.password}@127.0.0.1:${config.port}/quantrikpi\n`, { flag: 'wx', mode: 0o600 });
else if (!/^DATABASE_URL=/m.test(readFileSync(envPath, 'utf8'))) throw new Error('.env.local đã tồn tại nhưng chưa có DATABASE_URL. Thêm cấu hình theo server/POSTGRESQL.md.');
console.log(`PostgreSQL local đang chạy tại 127.0.0.1:${config.port}; database quantrikpi. Cấu hình kết nối trong .env.local.`);
