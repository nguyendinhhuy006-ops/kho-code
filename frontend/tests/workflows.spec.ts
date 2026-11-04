import { test, expect, type Page } from '@playwright/test';
import { createDatabase } from '../server/database';
import { scryptSync, randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { createSeed } from '../src/mocks/seed';

const accounts = { tdv: 'tdv@quantrikpi.local', bgh: 'bgh@quantrikpi.local', gv: 'giangvien@quantrikpi.local', admin: 'admin@quantrikpi.local' };
const testPassword = 'KiemThu!2026-Long';
test.beforeEach(async () => {
  const dir = process.env.API_DATA_DIR!;
  if (!dir.includes('e2e-')) throw new Error('Chỉ khởi tạo lại cơ sở dữ liệu kiểm thử riêng.');
  if (!/^e2e_\d+$/.test(process.env.DATABASE_SCHEMA ?? '')) throw new Error('Chỉ khởi tạo schema E2E riêng.');
  const db = createDatabase();
  const seed = createSeed();
  try {
    await db.transaction(async () => {
      await db.writeStore(seed);
      await db.query('DELETE FROM {{sessions}}; DELETE FROM {{attempts}}; DELETE FROM {{credentials}};');
      for (const u of seed.users) { const salt = randomBytes(24).toString('hex'); const hash = scryptSync(testPassword, salt, 64).toString('hex'); await db.query('INSERT INTO {{credentials}}(user_id,salt,hash) VALUES(@arg1,@arg2,@arg3)', [u.id, salt, hash]); }
    });
  } finally { await db.close(); }
});
async function login(page: Page, account: keyof typeof accounts) {
  await page.goto('/#/login');
  await page.getByLabel('Email đăng nhập').fill(accounts[account]);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(testPassword);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.locator('h1')).toBeVisible();
}
async function logout(page: Page) { await page.locator('.sidebar').getByRole('button', { name: 'Đăng xuất' }).click(); await expect(page).toHaveURL(/login/); }
async function confirm(page: Page) { await page.getByRole('button', { name: 'Xác nhận', exact: true }).click(); await expect(page.locator('.ant-modal-confirm')).toHaveCount(0); }

test('Ma trận quyền lưu, áp dụng phía máy chủ và khôi phục mặc định', async ({ page }) => {
  await login(page, 'admin'); await page.goto('/#/roles');
  const toggle = page.getByRole('switch', { name: 'Trưởng đơn vị · Kế hoạch năm học', exact: true });
  await expect(toggle).toBeChecked(); await toggle.click();
  await expect(page.getByRole('switch', { name: 'Trưởng đơn vị · Lập và sửa kế hoạch', exact: true })).not.toBeChecked();
  await page.getByRole('button', { name: 'Lưu ma trận quyền', exact: true }).click();
  await page.getByLabel('Lý do thay đổi quyền').fill('Tạm dừng lập kế hoạch để rà soát');
  await page.getByRole('button', { name: 'Xác nhận lưu' }).click();
  await expect(page.getByText('Đã lưu · phiên bản 1')).toBeVisible();
  await page.reload(); await expect(toggle).not.toBeChecked();
  await logout(page); await login(page, 'tdv');
  await expect(page.locator('.sidebar').getByRole('link', { name: 'Kế hoạch năm học', exact: true })).toHaveCount(0);
  await page.goto('/#/plans'); await expect(page.getByRole('heading', { name: 'Không đủ quyền truy cập' })).toBeVisible();
  const denied = await page.request.post('/api/commands', { data: { type: 'plan.save', value: { title: 'Không được phép', yearId: 'y1' } } });
  expect(denied.status()).toBe(400); expect((await denied.json()).message).toContain('quyền');
  await logout(page); await login(page, 'admin'); await page.goto('/#/roles');
  await page.getByRole('button', { name: 'Khôi phục mặc định', exact: true }).click();
  await page.getByRole('button', { name: 'Khôi phục', exact: true }).click();
  await page.getByRole('button', { name: 'Lưu ma trận quyền', exact: true }).click();
  await page.getByLabel('Lý do thay đổi quyền').fill('Hoàn tất rà soát, khôi phục quyền');
  await page.getByRole('button', { name: 'Xác nhận lưu' }).click();
  await expect(page.getByText('Đã lưu · phiên bản 2')).toBeVisible();
  await page.goto('/#/logs'); await expect(page.getByText('Cập nhật ma trận quyền').first()).toBeVisible();
  await logout(page); await login(page, 'tdv'); await page.goto('/#/plans');
  await expect(page.getByRole('button', { name: 'Tạo kế hoạch' })).toBeVisible();
});

test('Ma trận quyền chặn sửa trái phép, phiên cũ và hiển thị trên điện thoại', async ({ page }) => {
  await login(page, 'admin');
  const snapshot = await (await page.request.get('/api/session')).json();
  const { defaultAccess } = await import('../src/shared/domain');
  const value = snapshot.data.access ?? defaultAccess();
  const command = { type: 'access.save', value, reason: 'Kiểm tra đồng thời' };
  expect((await page.request.post('/api/commands', { data: command })).status()).toBe(200);
  const stale = await page.request.post('/api/commands', { data: command });
  expect(stale.status()).toBe(400); expect((await stale.json()).message).toContain('phiên khác');
  await page.setViewportSize({ width: 375, height: 812 }); await page.goto('/#/roles');
  await expect(page.getByRole('heading', { name: 'Vai trò & phân quyền', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await page.screenshot({ path: 'artifacts/role-matrix-mobile.png' });
  await page.setViewportSize({ width: 1440, height: 1050 });
  await logout(page); await login(page, 'gv');
  const forbidden = await page.request.post('/api/commands', { data: { ...command, value: { ...value, revision: 1 } } });
  expect(forbidden.status()).toBe(400); expect((await forbidden.json()).message).toContain('quản trị');
});

test('Admin chỉnh được mọi ô và cấp quyền ngoài bộ mặc định có hiệu lực thật', async ({ page }) => {
  await login(page, 'admin'); await page.goto('/#/roles');
  const switches = page.getByRole('switch');
  expect(await switches.count()).toBe(96);
  for (const toggle of await switches.all()) await expect(toggle).toBeEnabled();
  await page.getByRole('switch', { name: 'Quản trị viên · Phê duyệt kế hoạch', exact: true }).click();
  await page.getByRole('switch', { name: 'Cán bộ / Giảng viên · Phê duyệt kế hoạch', exact: true }).click();
  await page.getByRole('switch', { name: 'Cán bộ / Giảng viên · Tổng quan', exact: true }).click();
  await page.getByRole('button', { name: 'Lưu ma trận quyền', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Cán bộ / Giảng viên · Phê duyệt kế hoạch: Bật');
  await page.getByLabel('Lý do thay đổi quyền').fill('Cấp quyền bổ sung theo yêu cầu');
  await page.getByRole('button', { name: 'Xác nhận lưu' }).click();
  await expect(page.getByText('Đã lưu · phiên bản 1')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('switch', { name: 'Quản trị viên · Phê duyệt kế hoạch', exact: true })).toBeChecked();
  await page.goto('/#/plans');
  const row = page.getByRole('row').filter({ hasText: 'Kế hoạch nghiên cứu khoa học' }).first();
  const snapshot = await (await page.request.get('/api/session')).json();
  const submitted = snapshot.data.plans.find((p: { status: string }) => p.status === 'submitted');
  expect(submitted).toBeTruthy();
  const response = await page.request.post('/api/commands', { data: { type: 'plan.review', id: submitted.id, approved: true } });
  expect(response.status()).toBe(200);
  await logout(page); await login(page, 'gv'); await page.goto('/#/plans');
  await expect(page.getByRole('heading', { name: 'Kế hoạch năm học', exact: true })).toBeVisible();
  await expect(page.locator('.sidebar').getByRole('link', { name: 'Tổng quan', exact: true })).toHaveCount(0);
});

test('Luồng xuyên suốt ba vai trò với dữ liệu được lưu', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await login(page, 'tdv');
  await page.goto('/#/plans');
  await page.getByRole('button', { name: 'Tạo kế hoạch' }).click();
  await page.getByLabel('Tên kế hoạch', { exact: true }).fill('Kế hoạch kiểm thử tích hợp');
  await page.getByLabel('Mục tiêu thực hiện', { exact: true }).fill('Chuẩn hóa học liệu để phục vụ giảng dạy trong năm học.');
  await page.getByLabel('Sản phẩm và kết quả cần đạt', { exact: true }).fill('Bộ học liệu và biên bản rà soát của bộ môn.');
  await page.getByLabel('Ngày bắt đầu kế hoạch').fill('2026-09-01');
  await page.getByLabel('Ngày kết thúc kế hoạch').fill('2027-07-31');
  await page.getByRole('button', { name: 'Lưu thông tin' }).click();
  let row = page.getByRole('row').filter({ hasText: 'Kế hoạch kiểm thử tích hợp' });
  await row.getByRole('button', { name: 'Trình duyệt' }).click(); await confirm(page);
  await expect(row).toContainText('Chờ phê duyệt');
  await logout(page); await login(page, 'bgh');
  await page.goto('/#/plans');
  row = page.getByRole('row').filter({ hasText: 'Kế hoạch kiểm thử tích hợp' });
  await row.getByRole('button', { name: 'Phê duyệt', exact: true }).click(); await confirm(page);
  await expect(row).toContainText('Đã duyệt');
  await logout(page); await login(page, 'tdv');
  await page.goto('/#/plans');
  row = page.getByRole('row').filter({ hasText: 'Kế hoạch kiểm thử tích hợp' });
  await row.getByRole('button', { name: 'Giao nhiệm vụ' }).click();
  await page.getByLabel('Tên nhiệm vụ', { exact: true }).fill('Nhiệm vụ kiểm thử tích hợp');
  await page.getByLabel('Nội dung và yêu cầu công việc', { exact: true }).fill('Biên soạn học liệu và rà soát theo đề cương.');
  await page.getByLabel('Sản phẩm bàn giao / tiêu chí nghiệm thu', { exact: true }).fill('Bộ bài giảng hoàn chỉnh có xác nhận của bộ môn.');
  await page.getByLabel('Người thực hiện', { exact: true }).click(); await page.getByText('Lê Thu Hà', { exact: true }).last().click();
  await page.getByLabel('Hạn hoàn thành').fill('2026-12-20');
  await page.getByRole('button', { name: 'Lưu thông tin' }).click();
  await logout(page); await login(page, 'gv');
  await page.goto('/#/tasks');
  row = page.getByRole('row').filter({ hasText: 'Nhiệm vụ kiểm thử tích hợp' });
  await row.getByRole('button', { name: 'Cập nhật' }).click();
  await page.getByLabel('Tiến độ (%)').fill('100');
  await page.getByLabel('Tham chiếu minh chứng').fill('Biên bản kiểm thử hoàn thành');
  await page.getByRole('button', { name: 'Gửi nghiệm thu', exact: true }).click();
  await expect(row).toContainText('Chờ nghiệm thu');
  await logout(page); await login(page, 'tdv'); await page.goto('/#/tasks');
  row = page.getByRole('row').filter({ hasText: 'Nhiệm vụ kiểm thử tích hợp' });
  await row.getByRole('button', { name: 'Nghiệm thu', exact: true }).click(); await confirm(page);
  await page.reload();
  await expect(page.getByRole('row').filter({ hasText: 'Nhiệm vụ kiểm thử tích hợp' })).toContainText('Đã nghiệm thu');
  expect(errors).toEqual([]);
});

test('Quản trị viên sửa tài khoản và bị chặn đường dẫn nghiệp vụ', async ({ page }) => {
  await login(page, 'admin');
  await expect(page.locator('.sidebar')).not.toContainText('Kế hoạch năm học');
  await page.goto('/#/plans'); await expect(page.locator('h1')).toHaveText('Không đủ quyền truy cập');
  await page.goto('/#/accounts');
  const row = page.getByRole('row').filter({ hasText: accounts.gv });
  await row.getByRole('button', { name: 'Chỉnh sửa' }).click();
  await page.getByLabel('Tài khoản hoạt động').uncheck();
  await page.getByRole('button', { name: 'Lưu thông tin' }).click();
  await expect(row).toContainText('Đã khóa');
  await logout(page);
  await page.getByLabel('Email đăng nhập').fill(accounts.gv);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(testPassword);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.locator('.login-error')).toContainText('Email hoặc mật khẩu không chính xác.');
});

test('Giảng viên không thấy công việc người khác và không vào trang tài khoản', async ({ page }) => {
  await login(page, 'gv'); await page.goto('/#/tasks');
  await expect(page.getByRole('table')).not.toContainText('Hoàn thiện ngân hàng câu hỏi');
  await expect(page.getByRole('table')).not.toContainText('Báo cáo kết quả khảo sát doanh nghiệp');
  await page.goto('/#/accounts'); await expect(page.locator('h1')).toHaveText('Không đủ quyền truy cập');
});

for (const role of ['tdv', 'bgh', 'gv', 'admin'] as const) {
  test(`Dashboard ${role} hiển thị không có lỗi trình duyệt`, async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    await login(page, role); await expect(page.locator('.welcome-banner')).toBeVisible();
    await page.screenshot({ path: `artifacts/dashboard-${role}.png`, fullPage: true });
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test('Mobile 375px có menu và không tràn ngang toàn trang', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 }); await login(page, 'gv');
  await expect(page.locator('.sidebar')).not.toBeVisible();
  await page.getByRole('button', { name: 'Mở menu' }).click();
  await page.getByRole('dialog').getByRole('link', { name: 'Nhiệm vụ của tôi' }).click();
  await expect(page.locator('h1')).toHaveText('Nhiệm vụ của tôi');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const card = page.locator('.mobile-task').filter({ hasText: 'Xây dựng học liệu số môn Cơ sở dữ liệu' });
  await card.getByRole('button', { name: 'Cập nhật' }).click();
  await expect(page.getByLabel('Tiến độ (%)')).toHaveValue('65');
  await page.getByLabel('Tiến độ (%)').fill('75');
  await page.getByRole('button', { name: 'Lưu tiến độ', exact: true }).click();
  await expect(card).toContainText('75%');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.screenshot({ path: 'artifacts/mobile-tasks.png', fullPage: true });
});

test('Kết quả đầu vào đi từ giảng viên qua trình duyệt tới công bố', async ({ page }) => {
  await login(page, 'gv'); await page.goto('/#/performance');
  let row = page.getByRole('row').filter({ hasText: 'Học phần có học liệu số' });
  await row.getByRole('button', { name: 'Cập nhật' }).click();
  await expect(page.getByRole('spinbutton', { name: 'Kết quả thực hiện' })).toHaveValue('2');
  await page.getByRole('spinbutton', { name: 'Kết quả thực hiện' }).fill('4');
  await page.getByRole('button', { name: 'Lưu thông tin' }).click();
  await expect(row.getByRole('button', { name: 'Trình duyệt' })).toHaveCount(0);
  await logout(page); await login(page, 'tdv'); await page.goto('/#/performance');
  row = page.getByRole('row').filter({ hasText: 'Học phần có học liệu số' });
  await row.getByRole('button', { name: 'Trình duyệt' }).click(); await confirm(page);
  await logout(page); await login(page, 'bgh'); await page.goto('/#/performance');
  row = page.getByRole('row').filter({ hasText: 'Học phần có học liệu số' });
  await row.getByRole('button', { name: 'Công bố', exact: true }).click(); await confirm(page);
  await logout(page); await login(page, 'gv'); await page.goto('/#/performance');
  row = page.getByRole('row').filter({ hasText: 'Học phần có học liệu số' });
  await expect(row).toContainText('Đã công bố');
  await expect(row.getByRole('button', { name: 'Cập nhật', exact: true })).toHaveCount(0);
  await expect(row.getByRole('button', { name: 'Trình duyệt', exact: true })).toHaveCount(0);
});

test('Báo cáo CSV chỉ chứa nhiệm vụ trong đơn vị', async ({ page }) => {
  await login(page, 'tdv'); await page.goto('/#/reports');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Xuất CSV' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('bao-cao-nhiem-vu.csv');
  const stream = await download.createReadStream(); const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const csv = Buffer.concat(chunks).toString('utf8');
  expect(csv).toContain('Xây dựng học liệu số môn Cơ sở dữ liệu');
  expect(csv).not.toContain('Báo cáo kết quả khảo sát doanh nghiệp');
});

test('Trang đăng nhập có logo thật và không còn nhãn demo', async ({ page }) => {
  await page.goto('/#/login');
  await expect(page.getByRole('heading', { name: 'Đăng nhập hệ thống' })).toBeVisible();
  const logo = page.getByRole('img', { name: 'Logo Đại học Hải Phòng' });
  await expect(logo).toBeVisible();
  await expect.poll(() => logo.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);
  await expect(page.getByRole('combobox')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(/demo|thử nghiệm|mô phỏng/i);
  await page.screenshot({ path: 'artifacts/login-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/login-mobile.png', fullPage: true });
});

test('Sai mật khẩu không tạo phiên; tài khoản cũ trong sessionStorage không vượt được đăng nhập', async ({ page }) => {
  await page.goto('/#/login');
  await page.evaluate(() => { sessionStorage.setItem('quantri-kpi-demo-user', 'bgh'); localStorage.setItem('quantri-kpi-demo-v1', JSON.stringify({ users: [{ id: 'bgh', role: 'BGH', active: true }] })); });
  await page.goto('/#/plans'); await expect(page).toHaveURL(/login/);
  await page.getByLabel('Email đăng nhập').fill(accounts.bgh);
  await page.getByLabel('Mật khẩu', { exact: true }).fill('SaiMatKhau123');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.locator('.login-error')).toContainText('Email hoặc mật khẩu không chính xác.');
  expect((await page.request.get('/api/session')).status()).toBe(401);
  expect((await page.request.post('/api/commands', { data: { type: 'plan.review', id: 'p2', approved: true } })).status()).toBe(401);
});

test('Máy chủ lọc dữ liệu và từ chối giả mạo vai trò hoặc thao tác ngoài phạm vi', async ({ page }) => {
  await login(page, 'gv');
  const session = await (await page.request.get('/api/session')).json();
  expect(session.data.users.map((u: { id: string }) => u.id)).toEqual(['gv']);
  expect(session.data.tasks.every((t: { assigneeId: string }) => t.assigneeId === 'gv')).toBe(true);
  expect(session.data.indicators.every((i: { userId: string }) => i.userId === 'gv')).toBe(true);
  expect(JSON.stringify(session)).not.toMatch(/"hash"|"salt"|"password"/);
  expect((await page.request.post('/api/commands', { data: { type: 'plan.review', id: 'p2', approved: true, actorId: 'bgh', role: 'BGH' } })).status()).toBe(400);
  expect((await page.request.post('/api/commands', { data: { type: 'task.update', id: 't3', progress: 100, evidence: 'Thử', submit: true } })).status()).toBe(400);
  expect((await page.request.post('/api/commands', { data: { type: 'not.allowed' } })).status()).toBe(400);
});

test('Cookie HttpOnly và đăng xuất thu hồi phiên trên máy chủ', async ({ page }) => {
  await login(page, 'tdv');
  const sessionCookie = (await page.context().cookies()).find(c => c.name === 'quantrikpi_session')!;
  expect(sessionCookie.httpOnly).toBe(true); expect(sessionCookie.sameSite).toBe('Strict');
  await logout(page);
  const response = await page.request.get('/api/session', { headers: { Cookie: `${sessionCookie.name}=${sessionCookie.value}` } });
  expect(response.status()).toBe(401);
});

test('Đổi mật khẩu hoạt động và thu hồi các phiên khác', async ({ page, playwright }) => {
  await login(page, 'gv');
  const other = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:5183' });
  expect((await other.post('/api/auth/login', { data: { email: accounts.gv, password: testPassword } })).status()).toBe(200);
  await page.locator('.sidebar').getByRole('button', { name: 'Đổi mật khẩu' }).click();
  await page.getByLabel('Mật khẩu hiện tại', { exact: true }).fill(testPassword);
  await page.getByLabel('Mật khẩu mới', { exact: true }).fill('MatKhauMoi!2026');
  await page.getByLabel('Xác nhận mật khẩu mới', { exact: true }).fill('MatKhauMoi!2026');
  await page.getByRole('button', { name: 'Lưu mật khẩu' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect((await other.get('/api/session')).status()).toBe(401);
  await logout(page);
  expect((await page.request.post('/api/auth/login', { data: { email: accounts.gv, password: testPassword } })).status()).toBe(401);
  expect((await page.request.post('/api/auth/login', { data: { email: accounts.gv, password: 'MatKhauMoi!2026' } })).status()).toBe(200);
  await other.dispose();
});

test('Quản trị tạo tài khoản có mật khẩu và tài khoản mới đăng nhập được', async ({ page }) => {
  await login(page, 'admin'); await page.goto('/#/accounts');
  await page.getByRole('button', { name: 'Thêm tài khoản' }).click();
  await page.getByLabel('Họ và tên').fill('Giảng viên mới');
  await page.getByLabel('Email', { exact: true }).fill('moi@quantrikpi.local');
  await page.getByLabel('Mật khẩu khởi tạo').fill('TaiKhoanMoi!2026');
  await page.getByLabel('Đơn vị', { exact: true }).click(); await page.getByText('Khoa Công nghệ thông tin', { exact: true }).last().click();
  const saveAccountResponse = page.waitForResponse(response => response.url().endsWith('/api/commands') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Lưu thông tin' }).click();
  expect((await saveAccountResponse).status()).toBe(200);
  await expect(page.getByRole('row').filter({ hasText: 'moi@quantrikpi.local' })).toBeVisible();
  await logout(page);
  await page.getByLabel('Email đăng nhập').fill('moi@quantrikpi.local'); await page.getByLabel('Mật khẩu', { exact: true }).fill('TaiKhoanMoi!2026');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click(); await expect(page).toHaveURL(/dashboard/);
  await expect(page.locator('.sidebar')).toContainText('Cán bộ / Giảng viên');
});

test('Từ chối nguồn gửi khác trang và giới hạn nhập sai liên tiếp', async ({ request }) => {
  expect((await request.post('/api/auth/login', { headers: { Origin: 'https://website-khac.invalid' }, data: { email: accounts.admin, password: testPassword } })).status()).toBe(403);
  for (let i = 0; i < 10; i++) expect((await request.post('/api/auth/login', { data: { email: accounts.admin, password: 'khong-chinh-xac' } })).status()).toBe(401);
  expect((await request.post('/api/auth/login', { data: { email: accounts.admin, password: testPassword } })).status()).toBe(429);
});

test('Không tải được cơ sở dữ liệu hoặc tệp tài khoản từ máy chủ giao diện', async ({ request }) => {
  const dir = process.env.API_DATA_DIR!.split(/[\\/]/).at(-1);
  // SQL Server no longer creates a SQLite file in the E2E data directory.
  writeFileSync(`${process.env.API_DATA_DIR}/postgres-settings.json`, JSON.stringify({ password: testPassword }), { flag: 'wx' });
  const paths = [`.data/${dir}/tai-khoan-ban-dau.txt`, `.data/${dir}/postgres-settings.json`];
  if (existsSync('.env.local')) paths.push('.env.local');
  for (const path of paths) {
    const response = await request.get(`/${path}`);
    expect(response.status()).toBe(403);
    expect(await response.text()).not.toContain(testPassword);
  }
});

test('Hồ sơ kế hoạch có nội dung thực hiện, sản phẩm và lịch sử phê duyệt', async ({ page }) => {
  await login(page, 'bgh'); await page.goto('/#/plans');
  const row = page.getByRole('row').filter({ hasText: 'Phát triển hoạt động nghiên cứu khoa học' });
  await row.getByRole('button', { name: 'Xem chi tiết', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'Hồ sơ chi tiết' });
  await expect(drawer).toContainText('Mục tiêu thực hiện'); await expect(drawer).toContainText('Danh sách hướng nghiên cứu');
  await expect(drawer).toContainText('01/09/2026 – 31/07/2027');
  await drawer.getByRole('button', { name: 'Phê duyệt', exact: true }).click(); await confirm(page);
  await expect(drawer).toContainText('Đã phê duyệt kế hoạch.');
  await expect(drawer).toContainText('Nguyễn Minh Anh');
  await page.screenshot({ path: 'artifacts/plan-details.png', fullPage: true });
  const response = await (await page.request.get('/api/session')).json();
  expect(response.data.logs.some((log: { entityId: string }) => log.entityId === 'p2')).toBe(true);
});

test('Giảng viên đọc yêu cầu bàn giao và lịch sử riêng của nhiệm vụ', async ({ page, playwright }) => {
  const other = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:5183' });
  await other.post('/api/auth/login', { data: { email: accounts.tdv, password: testPassword } });
  expect((await other.post('/api/commands', { data: { type: 'plan.save', value: { id: 'p4', title: 'Bồi dưỡng chuyên môn cho giảng viên', yearId: '2026' } } })).status()).toBe(200);
  await other.dispose();
  await login(page, 'gv'); await page.goto('/#/tasks');
  const row = page.getByRole('row').filter({ hasText: 'Xây dựng học liệu số môn Cơ sở dữ liệu' });
  await row.getByRole('button', { name: 'Cập nhật', exact: true }).click();
  await page.getByLabel('Tiến độ (%)').fill('70'); await page.getByRole('button', { name: 'Lưu tiến độ', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await row.getByRole('button', { name: 'Xem chi tiết', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'Hồ sơ chi tiết' });
  await expect(drawer).toContainText('Sản phẩm bàn giao / tiêu chí nghiệm thu');
  await expect(drawer).toContainText('Bộ bài giảng điện tử'); await expect(drawer).toContainText('Tiến độ 70%');
  const response = await (await page.request.get('/api/session')).json();
  expect(response.data.logs.every((log: { entityId: string }) => ['t1', 't2', 't5', 'i1', 'i2'].includes(log.entityId))).toBe(true);
});

test('Tạo hồ sơ đầy đủ, tải lại và đọc nội dung đã lưu', async ({ page }) => {
  await login(page, 'tdv'); await page.goto('/#/plans');
  await page.getByRole('button', { name: 'Tạo kế hoạch' }).click();
  await page.getByLabel('Tên kế hoạch', { exact: true }).fill('Kế hoạch rà soát chuẩn đầu ra');
  await page.getByLabel('Căn cứ lập kế hoạch').fill('Kết quả rà soát chương trình của bộ môn.');
  await page.getByLabel('Mục tiêu thực hiện', { exact: true }).fill('Rà soát sự liên kết giữa nội dung học phần và chuẩn đầu ra.');
  await page.getByLabel('Sản phẩm và kết quả cần đạt', { exact: true }).fill('Bảng đối chiếu và biên bản rà soát được đơn vị xác nhận.');
  await page.getByLabel('Ngày bắt đầu kế hoạch').fill('2026-11-01'); await page.getByLabel('Ngày kết thúc kế hoạch').fill('2027-06-30');
  await page.screenshot({ path: 'artifacts/plan-form.png', fullPage: true });
  await page.getByRole('button', { name: 'Lưu thông tin' }).click(); await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.reload(); const row = page.getByRole('row').filter({ hasText: 'Kế hoạch rà soát chuẩn đầu ra' });
  await row.getByRole('button', { name: 'Xem chi tiết', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'Hồ sơ chi tiết' });
  await expect(drawer).toContainText('Bảng đối chiếu và biên bản rà soát được đơn vị xác nhận.');
  await expect(drawer).toContainText('Kết quả rà soát chương trình của bộ môn.');
});

test('Bộ lọc báo cáo thay đổi số liệu, danh sách và tệp xuất nhất quán', async ({ page }) => {
  await login(page, 'bgh'); await page.goto('/#/reports');
  await page.getByLabel('Đơn vị thực hiện', { exact: true }).click(); await page.getByText('Khoa Kinh tế', { exact: true }).last().click();
  await expect(page.getByRole('table').last()).toContainText('Báo cáo kết quả khảo sát doanh nghiệp');
  await expect(page.getByRole('table').last()).not.toContainText('Xây dựng học liệu số môn Cơ sở dữ liệu');
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Xuất CSV' }).click();
  const stream = await (await downloadPromise).createReadStream(); const chunks: Buffer[] = []; for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const csv = Buffer.concat(chunks).toString('utf8'); expect(csv).toContain('Báo cáo kết quả khảo sát doanh nghiệp'); expect(csv).not.toContain('Xây dựng học liệu số môn Cơ sở dữ liệu');
  await page.getByLabel('Năm học', { exact: true }).click(); await page.getByText('2025 – 2026', { exact: true }).last().click();
  await expect(page.getByRole('table').last()).toContainText('Không có nhiệm vụ trong năm học và đơn vị đang chọn.');
  await page.getByRole('button', { name: 'Xóa bộ lọc', exact: true }).click();
  await expect(page.getByRole('table').last()).toContainText('Xây dựng học liệu số môn Cơ sở dữ liệu');
  await page.screenshot({ path: 'artifacts/reports-detailed.png', fullPage: true });
});

test('Chỉ tiêu có kỳ, cách xác định và minh chứng trong hồ sơ', async ({ page }) => {
  await login(page, 'gv'); await page.goto('/#/performance');
  await page.getByRole('row').filter({ hasText: 'Học phần có học liệu số' }).getByRole('button', { name: 'Xem chi tiết', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'Hồ sơ chi tiết' });
  await expect(drawer).toContainText('Năm học 2026 – 2027'); await expect(drawer).toContainText('Một học phần chỉ tính một lần trong kỳ.');
  await expect(drawer).toContainText('Danh mục học liệu'); await expect(drawer).toContainText('50%');
});

test('Nhóm cảnh báo hoạt động và hồ sơ chi tiết đọc được trên mobile', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await login(page, 'gv'); await page.goto('/#/alerts');
  await page.getByText('Cần bổ sung (0)', { exact: true }).click();
  await expect(page.getByRole('table')).toContainText('Không có nhiệm vụ thuộc nhóm cần bổ sung.');
  await page.getByText('Chờ nghiệm thu (1)', { exact: true }).click();
  await expect(page.getByRole('table')).toContainText('Rà soát đề cương học phần');
  await page.screenshot({ path: 'artifacts/alerts-detailed.png', fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 }); await page.goto('/#/tasks');
  await page.locator('.mobile-task').filter({ hasText: 'Xây dựng học liệu số môn Cơ sở dữ liệu' }).getByRole('button', { name: 'Xem chi tiết', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'Hồ sơ chi tiết' });
  await expect(drawer).toContainText('Bộ bài giảng điện tử');
  await expect.poll(async () => { const position = await drawer.boundingBox(); return position ? position.x + position.width : Infinity; }).toBeLessThanOrEqual(375.5);
  const box = await drawer.boundingBox(); expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.width).toBeLessThanOrEqual(375);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/mobile-details.png', fullPage: false });
  expect(errors).toEqual([]);
});
