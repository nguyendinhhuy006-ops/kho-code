import { randomUUID } from 'node:crypto';
import { apiError, findPlan, listPlans, planCommand, planVersion } from './plans.ts';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomBytes, createHash, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { createDatabase } from './database.ts';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createSeed } from '../src/mocks/seed.ts';
import { enrichInitialContent } from '../src/mocks/content.ts';
import { execute, canVisit, hasPermission, visiblePlans, visibleTasks, visibleIndicators, type Store, type User, type Command } from '../src/shared/domain.ts';

const derive = promisify(scrypt);
const dataDir = resolve(process.env.API_DATA_DIR ?? '.data');
mkdirSync(dataDir, { recursive: true });
const db = createDatabase();
await db.initialize();
const readStore = async (): Promise<Store> => db.readStore();
const writeStore = (value: Store) => db.writeStore(value);
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
async function hashPassword(password: string, salt: string) { return (await derive(password, salt, 64) as Buffer).toString('hex'); }
async function setPassword(userId: string, password: string) {
  const salt = randomBytes(24).toString('hex'); const hash = await hashPassword(password, salt);
  await db.setCredential(userId, salt, hash);
}
await db.transaction(async () => {
if (!(await readStore())) {
  if (process.env.NODE_ENV !== 'test' && existsSync(resolve(dataDir, 'quantrikpi.sqlite'))) {
    throw new Error('Có SQLite cũ nhưng SQL Server còn trống. Dừng API cũ rồi chạy npm run db:migrate trước khi khởi động.');
  }
  const seed = createSeed();
  const rows = ['TÀI KHOẢN KHỞI TẠO QUANTRIKPI', 'Chỉ dùng trên máy này. Không đưa tệp này lên Git hoặc chia sẻ công khai.', 'Đổi mật khẩu sau khi đăng nhập lần đầu. Các địa chỉ .local là tài khoản nội bộ, không phải hộp thư thật.', ''];
  // Fixed credentials exist only in the isolated test database.
  for (const u of seed.users) {
    const password = process.env.NODE_ENV === 'test' ? 'KiemThu!2026-Long' : randomBytes(15).toString('base64url');
    await setPassword(u.id, password); rows.push(`${u.name} (${u.role})\nEmail: ${u.email}\nMật khẩu: ${password}\n`);
  }
  writeFileSync(resolve(dataDir, 'tai-khoan-ban-dau.txt'), rows.join('\n'), { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  await writeStore(seed);
  console.log(`Đã tạo tài khoản. Thông tin đăng nhập: ${resolve(dataDir, 'tai-khoan-ban-dau.txt')}`);
}
const currentState = await readStore(); const enrichedState = enrichInitialContent(currentState);
if (JSON.stringify(currentState) !== JSON.stringify(enrichedState)) await writeStore(enrichedState);
});
if (process.argv.includes('--initialize-only')) { await db.close(); process.exit(0); }
const dummySalt = randomBytes(24).toString('hex');
const dummyHash = await hashPassword(randomBytes(20).toString('hex'), dummySalt);
const sessionTTL = 8 * 60 * 60 * 1000;
const secure = process.env.COOKIE_SECURE === 'true';
const cookieName = 'quantrikpi_session';
const allowedCommands = new Set(['access.save', 'plan.save', 'plan.submit', 'plan.review', 'task.create', 'task.update', 'task.review', 'indicator.create', 'indicator.update', 'indicator.submit', 'indicator.review', 'strategy.save', 'user.save', 'unit.save', 'year.save']);
const cookie = (token: string, maxAge: number) => `${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
function sendReply(res: ServerResponse, status: number, data: unknown) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(data)); }
function fail(message: string, status = 400): never { throw Object.assign(new Error(message), { status }); }
async function body(req: IncomingMessage) {
  if (!req.headers['content-type']?.startsWith('application/json')) fail('Định dạng yêu cầu không hợp lệ.', 415);
  const chunks: Buffer[] = []; let length = 0;
  for await (const chunk of req) { length += chunk.length; if (length > 32_768) fail('Nội dung yêu cầu quá lớn.', 413); chunks.push(chunk); }
  try { const v = JSON.parse(Buffer.concat(chunks).toString()); if (!v || typeof v !== 'object' || Array.isArray(v)) fail('Dữ liệu không hợp lệ.'); return v; } catch { fail('Dữ liệu không hợp lệ.'); }
}
async function session(req: IncomingMessage) {
  const token = req.headers.cookie?.split(';').map(c => c.trim()).find(c => c.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return undefined;
  const row = (await db.query('SELECT user_id, expires FROM {{sessions}} WHERE token_hash=@arg1', [hashToken(token)])).rows[0] as { user_id: string; expires: string } | undefined;
  if (!row || Number(row.expires) <= Date.now()) return undefined;
  const store = await readStore(); const user = store.users.find(u => u.id === row.user_id && u.active);
  return user ? { user, store, tokenHash: hashToken(token) } : undefined;
}
function scoped(store: Store, user: User): Store {
  const tasks = visibleTasks(store, user);
  const plans = [...new Map([...visiblePlans(store, user), ...store.plans.filter(p => tasks.some(t => t.planId === p.id))].map(p => [p.id, p])).values()];
  const logIds: Record<string, Set<string>> = {
    plan: new Set(visiblePlans(store, user).map(p => p.id)), task: new Set(tasks.map(t => t.id)),
    indicator: new Set(visibleIndicators(store, user).map(i => i.id)), strategy: new Set(canVisit(user, 'strategy', store) || canVisit(user, 'plans', store) ? store.strategies.map(s => s.id) : []),
  };
  return { ...store, plans, tasks, indicators: visibleIndicators(store, user),
    users: store.users.filter(u => hasPermission(user, 'admin.manage', store) || user.role === 'ADMIN' || user.role === 'BGH' || ((user.role === 'TDV' || hasPermission(user, 'task.assign', store) || hasPermission(user, 'performance.manage', store)) ? u.unitId === user.unitId : u.id === user.id)),
    strategies: canVisit(user, 'strategy', store) || canVisit(user, 'plans', store) ? store.strategies : [], logs: canVisit(user, 'logs', store) ? store.logs : store.logs.filter(log => log.entityType && log.entityId && logIds[log.entityType]?.has(log.entityId)),
  };
}
function checkPassword(value: unknown) { if (typeof value !== 'string' || value.length < 12 || value.length > 128) fail('Mật khẩu cần có từ 12 đến 128 ký tự.'); return value; }
function throttleKey(req: IncomingMessage, email: string) { return hashToken(`${req.socket.remoteAddress}:${email}`); }
async function limited(key: string) { const a = (await db.query('SELECT count, until_time FROM {{attempts}} WHERE [key]=@arg1', [key])).rows[0] as { count: number; until_time: string } | undefined; return a && Number(a.until_time) > Date.now() && a.count >= 10; }
async function recordFailure(key: string) { await db.recordFailure(key); }

const server = createServer(async (req, res) => {
  const requestId = randomUUID();
  res.setHeader('X-Request-Id', requestId);
  let pending: { status: number; data: unknown } | undefined;
  const reply = (_res: ServerResponse, status: number, data: unknown) => { pending = { status, data }; };
  try {
    await db.transaction(async () => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const path = url.pathname;
    const planRoute = /^\/api\/v1\/plans(?:\/([^/]+)(?:\/(submit|review))?)?$/.exec(path);
    if (req.method === 'GET' && path === '/api/health') { reply(res, 200, { ok: true, database: 'sqlserver' }); return; }
    if (req.method !== 'GET') {
      const origin = req.headers.origin;
      // Same-origin JSON requests only. A cross-site form cannot provide this content type.
      if (origin && origin !== `http://${req.headers.host}` && origin !== `https://${req.headers.host}`) fail('Nguồn yêu cầu không hợp lệ.', 403);
      if (req.headers['sec-fetch-site'] === 'cross-site') fail('Nguồn yêu cầu không hợp lệ.', 403);
    }
    if (req.method === 'POST' && path === '/api/auth/login') {
      const input = await body(req);
      if (typeof input.email !== 'string' || input.email.length > 200 || typeof input.password !== 'string' || input.password.length > 128) fail('Email hoặc mật khẩu không chính xác.', 401);
      const email = input.email.trim().toLowerCase(); const key = throttleKey(req, email); const ipKey = throttleKey(req, '*');
      if (await limited(key) || await limited(ipKey)) fail('Đã nhập sai nhiều lần. Vui lòng thử lại sau 15 phút.', 429);
      const state = await readStore(); const u = state.users.find(u => u.email.toLowerCase() === email);
      const cred = u && (await db.query('SELECT salt,hash FROM {{credentials}} WHERE user_id=@arg1', [u.id])).rows[0] as { salt: string; hash: string } | undefined;
      const hash = await hashPassword(input.password, cred?.salt ?? dummySalt);
      if (!u?.active || !cred || !timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(cred?.hash ?? dummyHash, 'hex'))) {
        await recordFailure(key); await recordFailure(ipKey);
        reply(res, 401, { code: 'HTTP_401', requestId, message: 'Email hoặc mật khẩu không chính xác.' }); return;
      }
      const current = await readStore(); const liveUser = current.users.find(v => v.id === u.id && v.active);
      const liveCred = (await db.query('SELECT salt,hash FROM {{credentials}} WHERE user_id=@arg1', [u.id])).rows[0] as { salt: string; hash: string } | undefined;
      if (!liveUser || liveCred?.hash !== cred.hash || liveCred?.salt !== cred.salt) fail('Email hoặc mật khẩu không chính xác.', 401);
      await db.query('DELETE FROM {{attempts}} WHERE [key]=@arg1', [key]);
      const old = await session(req); if (old) await db.query('DELETE FROM {{sessions}} WHERE token_hash=@arg1', [old.tokenHash]);
      const token = randomBytes(32).toString('hex');
      await db.query('DELETE FROM {{sessions}} WHERE expires < @arg1', [Date.now()]);
      await db.query('INSERT INTO {{sessions}}(token_hash,user_id,expires) VALUES(@arg1,@arg2,@arg3)', [hashToken(token), u.id, Date.now() + sessionTTL]);
      res.setHeader('Set-Cookie', cookie(token, sessionTTL / 1000));
      reply(res, 200, { userId: u.id, data: scoped(current, liveUser) }); return;
    }
    const auth = await session(req);
    if (!auth) fail('Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập lại.', 401);
    if (req.method === 'GET' && path === '/api/v1/me') { reply(res, 200, { user: auth.user }); return; }
    if (planRoute && req.method === 'GET') {
      if (planRoute[2]) apiError('Phương thức không được hỗ trợ.', 405, 'METHOD_NOT_ALLOWED');
      if (!canVisit(auth.user, 'plans', auth.store)) apiError('Bạn không có quyền xem kế hoạch.', 403, 'FORBIDDEN');
      if (!planRoute[1]) reply(res, 200, listPlans(auth.store, auth.user, url.searchParams));
      else { const item = findPlan(auth.store, auth.user, planRoute[1]); reply(res, 200, { item: { ...item, version: planVersion(item) } }); }
      return;
    }
    if (req.method === 'GET' && path === '/api/session') { reply(res, 200, { userId: auth.user.id, data: scoped(auth.store, auth.user) }); return; }
    if (req.method === 'POST' && path === '/api/auth/logout') {
      await body(req); await db.query('DELETE FROM {{sessions}} WHERE token_hash=@arg1', [auth.tokenHash]); res.setHeader('Set-Cookie', cookie('', 0)); reply(res, 200, { ok: true }); return;
    }
    if (req.method === 'POST' && path === '/api/auth/password') {
      const input = await body(req); const password = checkPassword(input.newPassword);
      const cred = (await db.query('SELECT salt,hash FROM {{credentials}} WHERE user_id=@arg1', [auth.user.id])).rows[0] as { salt: string; hash: string };
      if (typeof input.currentPassword !== 'string' || input.currentPassword.length > 128) fail('Mật khẩu hiện tại không chính xác.');
      const hash = await hashPassword(input.currentPassword, cred.salt);
      if (!timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(cred.hash, 'hex'))) fail('Mật khẩu hiện tại không chính xác.');
      const salt = randomBytes(24).toString('hex'); const newHash = await hashPassword(password, salt);
      const live = await session(req); const currentCred = (await db.query('SELECT hash FROM {{credentials}} WHERE user_id=@arg1', [auth.user.id])).rows[0] as { hash: string } | undefined;
      if (!live || currentCred?.hash !== cred.hash) fail('Phiên đăng nhập đã kết thúc.', 401);
      await db.transaction(async () => {
        await db.query('UPDATE {{credentials}} SET salt=@arg1,hash=@arg2 WHERE user_id=@arg3', [salt, newHash, auth.user.id]);
        await db.query('DELETE FROM {{sessions}} WHERE user_id=@arg1 AND token_hash<>@arg2', [auth.user.id, auth.tokenHash]);
      });
      reply(res, 200, { ok: true }); return;
    }
    if ((req.method === 'POST' && path === '/api/commands') || planRoute) {
      if (planRoute && !['POST', 'PATCH'].includes(req.method ?? '')) apiError('Phương thức không được hỗ trợ.', 405, 'METHOD_NOT_ALLOWED');
      const raw = await body(req);
      const liveAuth = await session(req); if (!liveAuth) fail('Phiên đăng nhập đã kết thúc.', 401);
      const input = planRoute ? planCommand(liveAuth.store, liveAuth.user, req.method!, planRoute[1], planRoute[2], raw) as Command & { password?: unknown } : raw;
      if (!allowedCommands.has(input.type)) fail('Thao tác không được hỗ trợ.');
      let passwordHash: { salt: string; hash: string } | undefined;
      if (input.type === 'user.save' && (!input.value?.id || input.password)) {
        if (!hasPermission(auth.user, 'admin.manage', auth.store)) fail('Bạn không có quyền quản lý tài khoản.', 403);
        const password = checkPassword(input.password); const salt = randomBytes(24).toString('hex');
        passwordHash = { salt, hash: await hashPassword(password, salt) };
      }
      // Re-read state and actor after asynchronous password hashing to avoid stale writes.
      const currentAuth = await session(req); if (!currentAuth) fail('Phiên đăng nhập đã kết thúc.', 401);
      let next: Store;
      try { next = execute(currentAuth.store, currentAuth.user.id, input as Command); }
      catch (e) { fail(e instanceof TypeError ? 'Dữ liệu thao tác không hợp lệ.' : (e as Error).message, 400); }
      await db.transaction(async () => {
        await writeStore(next);
        if (input.type === 'user.save') {
          const user = input.value.id ? next.users.find(u => u.id === input.value.id)! : next.users[next.users.length - 1];
          if (passwordHash) await db.setCredential(user.id, passwordHash.salt, passwordHash.hash);
          if (passwordHash || !user.active || currentAuth.store.users.find(u => u.id === user.id)?.role !== user.role || currentAuth.store.users.find(u => u.id === user.id)?.unitId !== user.unitId) {
            await db.query('DELETE FROM {{sessions}} WHERE user_id=@arg1 AND token_hash<>@arg2', [user.id, user.id === currentAuth.user.id ? currentAuth.tokenHash : '']);
          }
        }
      });
      const nextUser = next.users.find(u => u.id === currentAuth.user.id)!;
      reply(res, 200, { userId: nextUser.id, data: scoped(next, nextUser) }); return;
    }
    reply(res, 404, { message: 'Không tìm thấy chức năng.' });
    });
    if (pending) sendReply(res, pending.status, pending.data);
  } catch (e) { res.removeHeader('Set-Cookie'); const error = e as Error & { status?: number; code?: string }; if (!error.status) console.error('Lỗi xử lý yêu cầu:', error.name); sendReply(res, error.status ?? 500, { code: error.code ?? (error.status ? `HTTP_${error.status}` : 'INTERNAL_ERROR'), requestId, message: error.status ? error.message : 'Không thể xử lý yêu cầu. Vui lòng thử lại.' }); }
});
server.requestTimeout = 15_000;
server.headersTimeout = 10_000;
server.listen(Number(process.env.API_PORT ?? 3001), '127.0.0.1', () => console.log(`API sẵn sàng tại http://127.0.0.1:${process.env.API_PORT ?? 3001}`));
function shutdown() { server.close(async () => { await db.close(); process.exit(0); }); }
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
