import { describe, expect, it } from 'vitest';
import { createSeed } from '../mocks/seed';
import { canVisit, defaultAccess, hasPermission, execute, visibleIndicators, visiblePlans, visibleTasks, type Role } from './domain';
import { enrichInitialContent } from '../mocks/content';

describe('Ma trận quyền cấu hình', () => {
  it('lưu quyền, thu hồi thao tác và ghi nhận trước/sau', () => {
    const seed = createSeed(); const value = defaultAccess();
    value.roles.TDV.permissions = value.roles.TDV.permissions.filter(p => p !== 'plan.create');
    const next = execute(seed, 'admin', { type: 'access.save', value, reason: 'Điều chỉnh phân công' });
    expect(next.access?.revision).toBe(1);
    expect(hasPermission(next.users.find(u => u.id === 'tdv')!, 'plan.create', next)).toBe(false);
    expect(() => execute(next, 'tdv', { type: 'plan.save', value: { title: 'Kế hoạch', yearId: next.years[0].id } })).toThrow('quyền');
    expect(next.logs[0].detail).toContain('Điều chỉnh phân công');
    expect(next.logs[0].detail).toContain('Trước:');
  });
  it('admin cấp quyền chéo vai trò, sửa quyền quản trị; chặn người khác và phiên cũ', () => {
    const seed = createSeed(); const command = { type: 'access.save' as const, value: defaultAccess(), reason: 'Kiểm tra' };
    expect(() => execute(seed, 'tdv', command)).toThrow('quản trị');
    command.value.roles.GV.pages.push('plans'); command.value.roles.GV.permissions.push('plan.review');
    const granted = execute(seed, 'admin', command);
    expect(hasPermission(granted.users.find(u => u.id === 'gv')!, 'plan.review', granted)).toBe(true);
    command.value = defaultAccess(); command.value.roles.ADMIN.pages = ['dashboard'];
    command.value.roles.ADMIN.permissions = [];
    const restricted = execute(seed, 'admin', command);
    expect(canVisit(restricted.users.find(u => u.id === 'admin')!, 'accounts', restricted)).toBe(false);
    command.value = defaultAccess(); const next = execute(seed, 'admin', command);
    expect(() => execute(next, 'admin', command)).toThrow('phiên khác');
  });
  it('tắt trang, kiểm tra phụ thuộc, khôi phục mặc định và giữ dữ liệu', () => {
    const seed = createSeed(); const value = defaultAccess();
    value.roles.TDV.pages = value.roles.TDV.pages.filter(p => p !== 'plans');
    expect(() => execute(seed, 'admin', { type: 'access.save', value, reason: 'Tắt trang' })).toThrow('tương ứng');
    value.roles.TDV.permissions = value.roles.TDV.permissions.filter(p => !p.startsWith('plan.'));
    const next = execute(seed, 'admin', { type: 'access.save', value, reason: 'Tắt trang' });
    expect(canVisit(next.users.find(u => u.id === 'tdv')!, 'plans', next)).toBe(false);
    expect(seed.access).toBeUndefined(); expect(next.plans).toEqual(seed.plans);
    const reset = execute(next, 'admin', { type: 'access.save', value: { ...defaultAccess(), revision: 1 }, reason: 'Khôi phục' });
    expect(canVisit(reset.users.find(u => u.id === 'tdv')!, 'plans', reset)).toBe(true);
  });
});

describe('Phạm vi dữ liệu và đường dẫn', () => {
  it('giảng viên chỉ thấy nhiệm vụ và chỉ tiêu của mình', () => {
    const s = createSeed(); const gv = s.users.find(u => u.id === 'gv')!;
    expect(visibleTasks(s, gv).map(t => t.id)).toEqual(['t1', 't2', 't5']);
    expect(visibleIndicators(s, gv).map(i => i.id)).toEqual(['i1', 'i2']);
    expect(visiblePlans(s, gv)).toEqual([]);
    expect(canVisit(gv, 'accounts')).toBe(false);
    expect(canVisit(gv, 'plans')).toBe(false);
  });
  it('trưởng đơn vị không thấy dữ liệu khoa khác', () => {
    const s = createSeed(); const tdv = s.users.find(u => u.id === 'tdv')!;
    expect(visiblePlans(s, tdv).some(p => p.id === 'p3')).toBe(false);
    expect(visibleTasks(s, tdv).some(t => t.id === 't4')).toBe(false);
    expect(visibleIndicators(s, tdv).some(i => i.id === 'i4')).toBe(false);
    expect(() => execute(s, 'tdv', { type: 'plan.submit', id: 'p3' })).toThrow('phạm vi');
    expect(() => execute(s, 'tdv', { type: 'indicator.update', id: 'i4', actual: 1 })).toThrow('phạm vi');
  });
  it('quản trị viên không mặc nhiên được xem hoặc duyệt nghiệp vụ', () => {
    const s = createSeed(); const admin = s.users.find(u => u.id === 'admin')!;
    expect(visibleTasks(s, admin)).toEqual([]);
    expect(visiblePlans(s, admin)).toEqual([]);
    expect(visibleIndicators(s, admin)).toEqual([]);
    expect(canVisit(admin, 'plans')).toBe(false);
    expect(() => execute(s, 'admin', { type: 'plan.review', id: 'p2', approved: true })).toThrow('quyền');
  });
  it.each<Role>(['BGH', 'TDV', 'GV'])('%s không có quyền sửa tài khoản', role => {
    const s = createSeed(); const u = s.users.find(u => u.role === role)!;
    expect(() => execute(s, u.id, { type: 'unit.save', value: { name: 'Đơn vị thử' } })).toThrow('quyền');
  });
  it('tài khoản bị khóa không được đọc và ghi nghiệp vụ', () => {
    const s = createSeed(); s.users.find(u => u.id === 'tdv')!.active = false; const u = s.users.find(u => u.id === 'tdv')!;
    expect(canVisit(u, 'dashboard')).toBe(false); expect(visibleTasks(s, u)).toEqual([]);
    expect(() => execute(s, 'tdv', { type: 'plan.submit', id: 'p4' })).toThrow('khóa');
  });
});

describe('Luồng kế hoạch → giao việc → nghiệm thu', () => {
  it('thực hiện đầy đủ qua ba vai trò, giữ đầu vào bất biến và ghi lịch sử', () => {
    const initial = createSeed(); let s = execute(initial, 'tdv', { type: 'plan.save', value: { title: 'Kế hoạch thử', yearId: '2026', objective: 'Đổi mới nội dung đào tạo', deliverables: 'Học liệu và biên bản đối chiếu', startDate: '2026-09-01', endDate: '2027-07-31' } }); const p = s.plans[0];
    s = execute(s, 'tdv', { type: 'plan.submit', id: p.id });
    s = execute(s, 'bgh', { type: 'plan.review', id: p.id, approved: true });
    s = execute(s, 'tdv', { type: 'task.create', value: { title: 'Nhiệm vụ thử', planId: p.id, assigneeId: 'gv', due: '2026-12-15', description: 'Biên soạn nội dung', expectedOutput: 'Bộ bài giảng và biên bản' } }); const t = s.tasks[0];
    s = execute(s, 'gv', { type: 'task.update', id: t.id, progress: 50, evidence: '', submit: false });
    expect(s.tasks[0].status).toBe('working');
    s = execute(s, 'gv', { type: 'task.update', id: t.id, progress: 100, evidence: 'Biên bản thử', submit: true });
    s = execute(s, 'tdv', { type: 'task.review', id: t.id, accepted: false, reason: 'Bổ sung kết quả' });
    expect(s.tasks[0].reason).toBe('Bổ sung kết quả');
    s = execute(s, 'gv', { type: 'task.update', id: t.id, progress: 100, evidence: 'Biên bản đã bổ sung', submit: true });
    s = execute(s, 'tdv', { type: 'task.review', id: t.id, accepted: true });
    expect(s.tasks[0].status).toBe('accepted'); expect(s.tasks[0].reason).toBeUndefined();
    expect(s.logs).toHaveLength(9); expect(initial.logs).toHaveLength(0); expect(initial.plans).toHaveLength(4);
  });
  it('không giao việc từ kế hoạch chưa duyệt hoặc giao ra ngoài đơn vị', () => {
    const s = createSeed();
    expect(() => execute(s, 'tdv', { type: 'task.create', value: { title: 'Thử', planId: 'p4', assigneeId: 'gv', due: '2026-12-01' } })).toThrow('đã duyệt');
    expect(() => execute(s, 'tdv', { type: 'task.create', value: { title: 'Thử', planId: 'p1', assigneeId: 'gv3', due: '2026-12-01' } })).toThrow('trong đơn vị');
  });
  it('không cho giảng viên cập nhật người khác, duyệt hoặc gửi thiếu minh chứng', () => {
    const s = createSeed();
    expect(() => execute(s, 'gv', { type: 'task.update', id: 't3', progress: 100, evidence: 'Có', submit: true })).toThrow('phạm vi');
    expect(() => execute(s, 'gv', { type: 'task.review', id: 't2', accepted: true })).toThrow('quyền');
    expect(() => execute(s, 'gv', { type: 'task.update', id: 't1', progress: 100, evidence: ' ', submit: true })).toThrow('minh chứng');
    expect(() => execute(s, 'gv', { type: 'task.update', id: 't1', progress: 101, evidence: '', submit: false })).toThrow('0–100');
    expect(() => execute(s, 'gv', { type: 'task.update', id: 't5', progress: 0, evidence: '', submit: false })).toThrow('không cho phép');
  });
  it('chặn trả lại thiếu lý do, duyệt nháp và trình lặp', () => {
    const s = createSeed();
    expect(() => execute(s, 'bgh', { type: 'plan.review', id: 'p2', approved: false, reason: '  ' })).toThrow('lý do');
    expect(() => execute(s, 'bgh', { type: 'plan.review', id: 'p4', approved: true })).toThrow('chưa chờ');
    expect(() => execute(s, 'tdv', { type: 'plan.submit', id: 'p2' })).toThrow('trạng thái');
  });
  it('trả lại kế hoạch rồi chỉnh sửa và trình lại', () => {
    let s = execute(createSeed(), 'bgh', { type: 'plan.review', id: 'p2', approved: false, reason: 'Bổ sung thời hạn' });
    s = execute(s, 'tdv', { type: 'plan.save', value: { id: 'p2', title: 'Kế hoạch đã sửa', yearId: '2026' } });
    s = execute(s, 'tdv', { type: 'plan.submit', id: 'p2' });
    expect(s.plans.find(p => p.id === 'p2')?.status).toBe('submitted');
  });
});

describe('Nội dung hồ sơ và khả năng đối chiếu', () => {
  it('cho lưu nháp thiếu thông tin nhưng chặn trình hồ sơ chưa đủ', () => {
    const s = execute(createSeed(), 'tdv', { type: 'plan.save', value: { title: 'Hồ sơ chưa hoàn thiện', yearId: '2026' } });
    expect(() => execute(s, 'tdv', { type: 'plan.submit', id: s.plans[0].id })).toThrow('mục tiêu, sản phẩm');
  });
  it('từ chối ngày không tồn tại, thời gian đảo ngược và mục tiêu không hợp lệ', () => {
    const s = createSeed();
    expect(() => execute(s, 'tdv', { type: 'plan.save', value: { title: 'Thử', yearId: '2026', startDate: '2026-02-31', endDate: '2026-12-01' } })).toThrow('Thời gian');
    expect(() => execute(s, 'tdv', { type: 'plan.save', value: { title: 'Thử', yearId: '2026', startDate: '2026-12-02', endDate: '2026-12-01' } })).toThrow('Thời gian');
    expect(() => execute(s, 'tdv', { type: 'plan.save', value: { title: 'Thử', yearId: '2026', strategyId: 'missing' } })).toThrow('chiến lược');
  });
  it('không giao nhiệm vụ ngoài thời gian kế hoạch hoặc thiếu sản phẩm', () => {
    const s = createSeed(); const value = { title: 'Thử', planId: 'p1', assigneeId: 'gv', due: '2028-01-01', description: 'Yêu cầu thực hiện', expectedOutput: 'Sản phẩm đối chiếu' };
    expect(() => execute(s, 'tdv', { type: 'task.create', value })).toThrow('thời gian thực hiện kế hoạch');
    expect(() => execute(s, 'tdv', { type: 'task.create', value: { ...value, due: '2026-12-01', expectedOutput: '' } })).toThrow('sản phẩm bàn giao');
  });
  it('cho phép không nhập ngày bắt đầu khi hạn vẫn nằm trong kế hoạch', () => {
    const next = execute(createSeed(), 'tdv', { type: 'task.create', value: { title: 'Nhiệm vụ không có ngày bắt đầu', planId: 'p1', assigneeId: 'gv', due: '2026-12-01', startDate: '', description: 'Rà soát nội dung', expectedOutput: 'Biên bản rà soát' } });
    expect(next.tasks[0].title).toBe('Nhiệm vụ không có ngày bắt đầu');
  });
  it('chặn trình chỉ tiêu chưa có tham chiếu minh chứng', () => {
    const s = createSeed(); s.indicators[0].evidence = '';
    expect(() => execute(s, 'tdv', { type: 'indicator.submit', id: 'i1' })).toThrow('minh chứng');
  });
  it('lịch sử ghi đúng hồ sơ và lý do khi trả lại', () => {
    const s = execute(createSeed(), 'bgh', { type: 'plan.review', id: 'p2', approved: false, reason: 'Bổ sung sản phẩm đầu ra' });
    expect(s.logs[0]).toMatchObject({ entityType: 'plan', entityId: 'p2', title: 'Phát triển hoạt động nghiên cứu khoa học' });
    expect(s.logs[0].detail).toContain('Bổ sung sản phẩm đầu ra');
  });
  it('bổ sung nội dung cũ không ghi đè chỉnh sửa của người dùng', () => {
    const s = createSeed(); s.plans[0].objective = 'Nội dung do người dùng chỉnh sửa'; delete s.plans[0].deliverables;
    const oldTitle = s.tasks[0].title; s.tasks[0].title = 'Nhiệm vụ đã đổi tên'; delete s.tasks[0].description;
    const next = enrichInitialContent(s);
    expect(next.plans[0].objective).toBe('Nội dung do người dùng chỉnh sửa'); expect(next.plans[0].deliverables).toBeTruthy();
    expect(next.tasks[0].description).toBeUndefined(); expect(s.plans[0].deliverables).toBeUndefined(); expect(oldTitle).not.toBe(next.tasks[0].title);
  });
});

describe('KPI và quản trị', () => {
  it('GV chỉ cập nhật đầu vào; TDV trình và BGH công bố', () => {
    let s = execute(createSeed(), 'gv', { type: 'indicator.update', id: 'i1', actual: 4 });
    expect(() => execute(s, 'gv', { type: 'indicator.submit', id: 'i1' })).toThrow('quyền');
    expect(() => execute(s, 'gv', { type: 'indicator.review', id: 'i1', published: true })).toThrow('quyền');
    s = execute(s, 'tdv', { type: 'indicator.submit', id: 'i1' });
    s = execute(s, 'bgh', { type: 'indicator.review', id: 'i1', published: true });
    expect(s.indicators.find(i => i.id === 'i1')?.status).toBe('published');
    expect(() => execute(s, 'gv', { type: 'indicator.update', id: 'i1', actual: 5 })).toThrow('chưa trình');
  });
  it('không công bố nháp và không chấp nhận kết quả âm', () => {
    const s = createSeed();
    expect(() => execute(s, 'bgh', { type: 'indicator.review', id: 'i1', published: true })).toThrow('chưa chờ');
    expect(() => execute(s, 'gv', { type: 'indicator.update', id: 'i1', actual: -1 })).toThrow('không âm');
  });
  it('tài khoản không được trùng email hoặc tự khóa quản trị', () => {
    const s = createSeed(); const admin = s.users.find(u => u.id === 'admin')!;
    expect(() => execute(s, 'admin', { type: 'user.save', value: { ...admin, id: undefined } })).toThrow('Email');
    expect(() => execute(s, 'admin', { type: 'user.save', value: { ...admin, active: false } })).toThrow('tự khóa');
  });
  it('đổi vai trò cập nhật quyền ở thao tác kế tiếp', () => {
    const initial = createSeed(); const tdv = initial.users.find(u => u.id === 'tdv')!;
    const s = execute(initial, 'admin', { type: 'user.save', value: { ...tdv, role: 'GV' } });
    expect(canVisit(s.users.find(u => u.id === 'tdv')!, 'plans')).toBe(false);
    expect(() => execute(s, 'tdv', { type: 'plan.submit', id: 'p4' })).toThrow('quyền');
  });
});
