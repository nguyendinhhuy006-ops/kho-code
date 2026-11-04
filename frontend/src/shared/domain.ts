export type Role = 'BGH' | 'TDV' | 'GV' | 'ADMIN';
export type Page = 'dashboard' | 'strategy' | 'plans' | 'tasks' | 'performance' | 'alerts' | 'reports' | 'accounts' | 'units' | 'years' | 'roles' | 'logs';
export type Permission = 'strategy.manage' | 'plan.create' | 'plan.submit' | 'plan.review' | 'task.assign' | 'task.update' | 'task.review' | 'performance.manage' | 'performance.update' | 'performance.submit' | 'performance.publish' | 'admin.manage';
export interface User { id: string; name: string; email: string; role: Role; unitId: string; active: boolean }
export interface Unit { id: string; name: string }
export interface Year { id: string; name: string }
export interface PlanContent { strategyId?: string; objective?: string; deliverables?: string; startDate?: string; endDate?: string; reference?: string }
export interface TaskContent { description?: string; expectedOutput?: string; priority?: 'normal' | 'high' | 'urgent'; startDate?: string }
export interface IndicatorContent { period?: string; measurement?: string; evidence?: string }
export interface StrategyContent { period?: string; ownerUnitId?: string; expectedOutcome?: string }
export interface Plan extends PlanContent { id: string; title: string; unitId: string; yearId: string; status: 'draft' | 'submitted' | 'approved' | 'returned'; reason?: string }
export interface Task extends TaskContent { id: string; title: string; planId: string; assigneeId: string; due: string; progress: number; evidence: string; status: 'assigned' | 'working' | 'review' | 'accepted' | 'revision'; reason?: string }
export interface Indicator extends IndicatorContent { id: string; title: string; userId: string; target: number; actual: number; unit: string; status: 'draft' | 'submitted' | 'published'; reason?: string }
export interface Strategy extends StrategyContent { id: string; title: string; description: string }
export interface Audit { id: string; actor: string; action: string; time: string; entityId?: string; entityType?: string; title?: string; detail?: string }
export interface RolePolicy { pages: Page[]; permissions: Permission[] }
export interface AccessPolicy { revision: number; roles: Record<Role, RolePolicy> }
export interface Store { version: 1; access?: AccessPolicy; users: User[]; units: Unit[]; years: Year[]; plans: Plan[]; tasks: Task[]; indicators: Indicator[]; strategies: Strategy[]; logs: Audit[] }

export const roleNames: Record<Role, string> = { BGH: 'Ban Giám hiệu', TDV: 'Trưởng đơn vị', GV: 'Cán bộ / Giảng viên', ADMIN: 'Quản trị viên' };
export const permissionNames: Record<Permission, string> = {
  'strategy.manage': 'Quản lý mục tiêu chiến lược', 'plan.create': 'Lập và sửa kế hoạch', 'plan.submit': 'Trình kế hoạch',
  'plan.review': 'Phê duyệt kế hoạch', 'task.assign': 'Giao nhiệm vụ', 'task.update': 'Cập nhật tiến độ và gửi nghiệm thu',
  'task.review': 'Nghiệm thu nhiệm vụ', 'performance.manage': 'Giao chỉ tiêu', 'performance.update': 'Cập nhật kết quả đầu vào',
  'performance.submit': 'Trình kết quả', 'performance.publish': 'Duyệt và công bố kết quả', 'admin.manage': 'Quản lý tài khoản và danh mục',
};
export const rolePermissions: Record<Role, readonly Permission[]> = {
  BGH: ['strategy.manage', 'plan.review', 'performance.manage', 'performance.publish'],
  TDV: ['plan.create', 'plan.submit', 'task.assign', 'task.review', 'performance.manage', 'performance.update', 'performance.submit'],
  GV: ['task.update', 'performance.update'],
  ADMIN: ['admin.manage'],
};
export const pages: { key: Page; label: string; roles: Role[] }[] = [
  { key: 'dashboard', label: 'Tổng quan', roles: ['BGH', 'TDV', 'GV', 'ADMIN'] },
  { key: 'strategy', label: 'Mục tiêu chiến lược', roles: ['BGH', 'TDV'] },
  { key: 'plans', label: 'Kế hoạch năm học', roles: ['BGH', 'TDV'] },
  { key: 'tasks', label: 'Quản lý nhiệm vụ', roles: ['BGH', 'TDV', 'GV'] },
  { key: 'performance', label: 'Chỉ tiêu KPI / OKR', roles: ['BGH', 'TDV', 'GV'] },
  { key: 'alerts', label: 'Cảnh báo tiến độ', roles: ['BGH', 'TDV', 'GV'] },
  { key: 'reports', label: 'Báo cáo & thống kê', roles: ['BGH', 'TDV'] },
  { key: 'accounts', label: 'Quản lý tài khoản', roles: ['ADMIN'] },
  { key: 'units', label: 'Danh mục đơn vị', roles: ['ADMIN'] },
  { key: 'years', label: 'Danh mục năm học', roles: ['ADMIN'] },
  { key: 'roles', label: 'Vai trò & phân quyền', roles: ['ADMIN'] },
  { key: 'logs', label: 'Nhật ký hệ thống', roles: ['ADMIN'] },
];
export const roles: Role[] = ['BGH', 'TDV', 'GV', 'ADMIN'];
export const permissionPages: Record<Permission, Page> = {
  'strategy.manage': 'strategy', 'plan.create': 'plans', 'plan.submit': 'plans', 'plan.review': 'plans',
  'task.assign': 'tasks', 'task.update': 'tasks', 'task.review': 'tasks',
  'performance.manage': 'performance', 'performance.update': 'performance', 'performance.submit': 'performance', 'performance.publish': 'performance', 'admin.manage': 'accounts',
};
export const defaultAccess = (): AccessPolicy => ({ revision: 0, roles: Object.fromEntries(roles.map(role => [role, { pages: pages.filter(p => p.roles.includes(role)).map(p => p.key), permissions: [...rolePermissions[role]] }])) as Record<Role, RolePolicy> });
export const canVisit = (user: User, page: Page, store?: Pick<Store, 'access'>) => user.active && (store?.access ?? defaultAccess()).roles[user.role].pages.includes(page);
export const hasPermission = (user: User, permission: Permission, store?: Pick<Store, 'access'>) => user.active && (store?.access ?? defaultAccess()).roles[user.role].permissions.includes(permission) && canVisit(user, permissionPages[permission], store);
export const schoolScope = (u: User) => u.role === 'BGH' || u.role === 'ADMIN';
export const visiblePlans = (s: Store, u: User) => !u.active || (u.role === 'ADMIN' && !canVisit(u, 'plans', s) && !canVisit(u, 'tasks', s) && !canVisit(u, 'reports', s)) ? [] : s.plans.filter(p => schoolScope(u) || ((u.role === 'TDV' || canVisit(u, 'plans', s) || hasPermission(u, 'task.assign', s)) && p.unitId === u.unitId));
export const visibleTasks = (s: Store, u: User) => !u.active || (u.role === 'ADMIN' && !canVisit(u, 'tasks', s) && !canVisit(u, 'reports', s) && !canVisit(u, 'alerts', s)) ? [] : s.tasks.filter(t => {
  const plan = s.plans.find(p => p.id === t.planId);
  return schoolScope(u) || (u.role === 'TDV' || hasPermission(u, 'task.assign', s) || hasPermission(u, 'task.review', s) ? plan?.unitId === u.unitId : t.assigneeId === u.id);
});
export const visibleIndicators = (s: Store, u: User) => !u.active || (u.role === 'ADMIN' && !canVisit(u, 'performance', s)) ? [] : s.indicators.filter(i => schoolScope(u) || (u.role === 'TDV' || hasPermission(u, 'performance.manage', s) || hasPermission(u, 'performance.publish', s) ? s.users.find(a => a.id === i.userId)?.unitId === u.unitId : i.userId === u.id));
export const isOverdue = (task: Task) => task.status !== 'accepted' && task.due < new Date().toLocaleDateString('sv-SE');
export const id = () => crypto.randomUUID();

export type Command =
  | { type: 'access.save'; value: AccessPolicy; reason: string }
  | { type: 'plan.save'; value: Pick<Plan, 'title' | 'yearId'> & PlanContent & { id?: string } }
  | { type: 'plan.submit'; id: string }
  | { type: 'plan.review'; id: string; approved: boolean; reason?: string }
  | { type: 'task.create'; value: Pick<Task, 'title' | 'planId' | 'assigneeId' | 'due'> & TaskContent }
  | { type: 'task.update'; id: string; progress: number; evidence: string; submit: boolean }
  | { type: 'task.review'; id: string; accepted: boolean; reason?: string }
  | { type: 'indicator.create'; value: Pick<Indicator, 'title' | 'userId' | 'target' | 'unit'> & IndicatorContent }
  | { type: 'indicator.update'; id: string; actual: number; evidence?: string }
  | { type: 'indicator.submit'; id: string }
  | { type: 'indicator.review'; id: string; published: boolean; reason?: string }
  | { type: 'strategy.save'; value: Pick<Strategy, 'title' | 'description'> & StrategyContent & { id?: string } }
  | { type: 'user.save'; value: Omit<User, 'id'> & { id?: string } }
  | { type: 'unit.save' | 'year.save'; value: { id?: string; name: string } };

function requireRule(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
const textValid = (value: string, max = 200) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;
export const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
function contentFields<T extends object>(value: T, fields: (keyof T)[]): Partial<T> {
  const result: Partial<T> = {};
  for (const key of fields) if (value[key] !== undefined) {
    requireRule(typeof value[key] === 'string' && (value[key] as string).length <= 2000, 'Nội dung chi tiết tối đa 2.000 ký tự mỗi trường.');
    result[key] = (value[key] as string).trim() as T[keyof T];
  }
  return result;
}

// Shared business rules, enforced by the server for every authenticated command.
export function execute(store: Store, actorId: string, command: Command): Store {
  const s = structuredClone(store);
  const actor = s.users.find(u => u.id === actorId && u.active);
  requireRule(actor, 'Phiên không hợp lệ hoặc tài khoản đã bị khóa.');
  const permit = (p: Permission) => requireRule(hasPermission(actor, p, s), 'Bạn không có quyền thực hiện thao tác này.');
  const planById = (key: string) => { const p = visiblePlans(s, actor).find(p => p.id === key); requireRule(p, 'Không tìm thấy kế hoạch trong phạm vi quyền.'); return p; };
  const taskById = (key: string) => { const t = visibleTasks(s, actor).find(t => t.id === key); requireRule(t, 'Không tìm thấy nhiệm vụ trong phạm vi quyền.'); return t; };
  const indicatorById = (key: string) => { const i = visibleIndicators(s, actor).find(i => i.id === key); requireRule(i, 'Không tìm thấy chỉ tiêu trong phạm vi quyền.'); return i; };
  switch (command.type) {
    case 'access.save': {
      requireRule(actor.role === 'ADMIN', 'Chỉ quản trị viên được cấu hình ma trận quyền.');
      requireRule(textValid(command.reason, 500), 'Nhập lý do thay đổi quyền (tối đa 500 ký tự).');
      const v = command.value;
      requireRule(v && v.revision === (s.access?.revision ?? 0), 'Ma trận đã được thay đổi ở phiên khác. Tải lại trang trước khi lưu.');
      const next = defaultAccess();
      for (const role of roles) {
        const entry = v.roles?.[role];
        requireRule(entry && Array.isArray(entry.pages) && Array.isArray(entry.permissions), 'Cấu hình vai trò không hợp lệ.');
        requireRule(entry.pages.every(p => pages.some(page => page.key === p)) && entry.permissions.every(p => Object.hasOwn(permissionNames, p)), 'Mã trang hoặc quyền không hợp lệ.');
        requireRule(entry.permissions.every(p => entry.pages.includes(permissionPages[p])), 'Quyền thao tác yêu cầu quyền truy cập trang tương ứng.');
        next.roles[role] = { pages: [...new Set(entry.pages)], permissions: [...new Set(entry.permissions)] };
      }
      next.revision = v.revision + 1; s.access = next;
      s.logs.unshift({ id: id(), actor: actor.name, action: command.type, time: new Date().toISOString(), entityType: 'access', title: `Ma trận quyền · phiên bản ${next.revision}`, detail: `${command.reason.trim()}\n${roles.map(role => `${roleNames[role]}: ${next.roles[role].pages.length} trang, ${next.roles[role].permissions.length} thao tác`).join('; ')}\nTrước: ${JSON.stringify(store.access?.roles ?? defaultAccess().roles)}\nSau: ${JSON.stringify(next.roles)}` });
      return s;
    }
    case 'plan.save': {
      permit('plan.create'); const v = command.value;
      requireRule(textValid(v.title) && s.years.some(y => y.id === v.yearId), 'Nhập tên kế hoạch và chọn năm học hợp lệ.');
      const content = contentFields(v, ['strategyId', 'objective', 'deliverables', 'startDate', 'endDate', 'reference']);
      requireRule(!content.strategyId || s.strategies.some(i => i.id === content.strategyId), 'Mục tiêu chiến lược không tồn tại.');
      const old = v.id ? planById(v.id) : undefined;
      const start = content.startDate ?? old?.startDate; const end = content.endDate ?? old?.endDate;
      requireRule((!start && !end) || (start && end && validDate(start) && validDate(end) && start <= end), 'Thời gian kế hoạch chưa hợp lệ: nhập đủ ngày bắt đầu/kết thúc và đúng thứ tự.');
      if (old) { requireRule(['draft', 'returned'].includes(old.status), 'Chỉ được sửa kế hoạch nháp hoặc được trả lại.'); Object.assign(old, content, { title: v.title.trim(), yearId: v.yearId }); }
      else s.plans.unshift({ ...content, id: id(), title: v.title.trim(), unitId: actor.unitId, yearId: v.yearId, status: 'draft' });
      break;
    }
    case 'plan.submit': { permit('plan.submit'); const p = planById(command.id); requireRule(['draft', 'returned'].includes(p.status), 'Kế hoạch không ở trạng thái cho phép trình.'); requireRule(textValid(p.objective ?? '', 2000) && textValid(p.deliverables ?? '', 2000) && p.startDate && p.endDate && validDate(p.startDate) && validDate(p.endDate) && p.startDate <= p.endDate, 'Cần bổ sung mục tiêu, sản phẩm và thời gian thực hiện trước khi trình kế hoạch.'); p.status = 'submitted'; p.reason = undefined; break; }
    case 'plan.review': { permit('plan.review'); const p = planById(command.id); requireRule(p.status === 'submitted', 'Kế hoạch chưa chờ phê duyệt.'); requireRule(command.approved || textValid(command.reason ?? '', 2000), 'Cần nhập lý do yêu cầu chỉnh sửa.'); p.status = command.approved ? 'approved' : 'returned'; p.reason = command.approved ? undefined : command.reason?.trim(); break; }
    case 'task.create': {
      permit('task.assign'); const v = command.value; const p = planById(v.planId);
      requireRule(p.status === 'approved', 'Chỉ giao nhiệm vụ từ kế hoạch đã duyệt.');
      requireRule(s.users.some(u => u.id === v.assigneeId && u.active && u.role === 'GV' && u.unitId === p.unitId), 'Người nhận phải là cán bộ/giảng viên đang hoạt động trong đơn vị.');
      requireRule(textValid(v.title) && validDate(v.due), 'Nhập tên nhiệm vụ và hạn hoàn thành hợp lệ.');
      const content = contentFields(v, ['description', 'expectedOutput', 'priority', 'startDate']);
      requireRule(textValid(content.description ?? '', 2000) && textValid(content.expectedOutput ?? '', 2000), 'Cần mô tả nội dung công việc và sản phẩm bàn giao.');
      requireRule(!content.priority || ['normal', 'high', 'urgent'].includes(content.priority), 'Mức độ ưu tiên không hợp lệ.');
      requireRule(!content.startDate || (validDate(content.startDate) && content.startDate <= v.due), 'Ngày bắt đầu nhiệm vụ phải trước hoặc bằng hạn hoàn thành.');
      requireRule((!p.startDate || (content.startDate || v.due) >= p.startDate) && (!p.endDate || v.due <= p.endDate), 'Thời gian nhiệm vụ phải nằm trong thời gian thực hiện kế hoạch.');
      s.tasks.unshift({ ...content, title: v.title.trim(), planId: v.planId, assigneeId: v.assigneeId, due: v.due, id: id(), progress: 0, evidence: '', status: 'assigned' }); break;
    }
    case 'task.update': {
      permit('task.update'); const t = taskById(command.id);
      requireRule(['assigned', 'working', 'revision'].includes(t.status), 'Nhiệm vụ không cho phép cập nhật lúc này.');
      requireRule(Number.isFinite(command.progress) && command.progress >= 0 && command.progress <= 100, 'Tiến độ phải nằm trong khoảng 0–100.');
      requireRule(command.evidence.length <= 2000, 'Tham chiếu minh chứng tối đa 2.000 ký tự.');
      requireRule(!command.submit || (command.progress === 100 && textValid(command.evidence, 2000)), 'Để gửi nghiệm thu cần đạt 100% và có tham chiếu minh chứng.');
      t.progress = command.progress; t.evidence = command.evidence.trim(); t.status = command.submit ? 'review' : t.status === 'revision' ? 'revision' : 'working'; break;
    }
    case 'task.review': { permit('task.review'); const t = taskById(command.id); requireRule(t.status === 'review', 'Nhiệm vụ chưa chờ nghiệm thu.'); requireRule(command.accepted || textValid(command.reason ?? '', 2000), 'Cần nhập lý do yêu cầu bổ sung.'); t.status = command.accepted ? 'accepted' : 'revision'; t.reason = command.accepted ? undefined : command.reason?.trim(); break; }
    case 'indicator.create': {
      permit('performance.manage'); const v = command.value; const owner = s.users.find(u => u.id === v.userId && u.active && u.role === 'GV');
      requireRule(owner && (schoolScope(actor) || owner.unitId === actor.unitId), 'Người nhận chỉ tiêu nằm ngoài phạm vi.');
      requireRule(textValid(v.title) && textValid(v.unit, 40) && Number.isFinite(v.target) && v.target > 0, 'Tên, đơn vị tính và mục tiêu dương là bắt buộc.');
      const content = contentFields(v, ['period', 'measurement', 'evidence']);
      s.indicators.unshift({ ...content, userId: v.userId, target: v.target, title: v.title.trim(), unit: v.unit.trim(), id: id(), actual: 0, status: 'draft' }); break;
    }
    case 'indicator.update': { permit('performance.update'); const i = indicatorById(command.id); requireRule(i.status === 'draft', 'Chỉ cập nhật chỉ tiêu chưa trình duyệt.'); requireRule(Number.isFinite(command.actual) && command.actual >= 0, 'Kết quả phải là số không âm.'); Object.assign(i, contentFields(command, ['evidence'])); i.actual = command.actual; break; }
    case 'indicator.submit': { permit('performance.submit'); const i = indicatorById(command.id); requireRule(i.status === 'draft', 'Chỉ tiêu không ở trạng thái nháp.'); requireRule(textValid(i.evidence ?? '', 2000), 'Cần bổ sung minh chứng kết quả trước khi trình duyệt.'); i.status = 'submitted'; i.reason = undefined; break; }
    case 'indicator.review': { permit('performance.publish'); const i = indicatorById(command.id); requireRule(i.status === 'submitted', 'Chỉ tiêu chưa chờ duyệt.'); requireRule(command.published || textValid(command.reason ?? '', 2000), 'Nhập lý do yêu cầu đánh giá lại.'); i.status = command.published ? 'published' : 'draft'; i.reason = command.published ? undefined : command.reason?.trim(); break; }
    case 'strategy.save': { permit('strategy.manage'); const v = command.value; requireRule(textValid(v.title) && textValid(v.description, 2000), 'Nhập tên và mô tả mục tiêu.'); const content = contentFields(v, ['period', 'ownerUnitId', 'expectedOutcome']); requireRule(!content.ownerUnitId || s.units.some(u => u.id === content.ownerUnitId), 'Đơn vị chủ trì không hợp lệ.'); if (v.id) { const item = s.strategies.find(i => i.id === v.id); requireRule(item, 'Không tìm thấy mục tiêu.'); Object.assign(item, content, { title: v.title.trim(), description: v.description.trim() }); } else s.strategies.unshift({ ...content, id: id(), title: v.title.trim(), description: v.description.trim() }); break; }
    case 'user.save': {
      permit('admin.manage'); const v = command.value;
      requireRule(textValid(v.name, 100) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email) && v.email.length <= 200, 'Tên và email phải hợp lệ.');
      requireRule(Object.keys(roleNames).includes(v.role) && s.units.some(u => u.id === v.unitId) && typeof v.active === 'boolean', 'Chọn vai trò, trạng thái và đơn vị hợp lệ.');
      requireRule(!s.users.some(u => u.id !== v.id && u.email.toLowerCase() === v.email.trim().toLowerCase()), 'Email đã được sử dụng.');
      requireRule(v.id !== actor.id || (v.active && v.role === 'ADMIN'), 'Không thể tự khóa hoặc thay vai trò quản trị của phiên hiện tại.');
      if (v.id) { const old = s.users.find(u => u.id === v.id); requireRule(old, 'Không tìm thấy tài khoản.'); Object.assign(old, v, { name: v.name.trim(), email: v.email.trim().toLowerCase() }); }
      else s.users.push({ ...v, id: id(), name: v.name.trim(), email: v.email.trim().toLowerCase() }); break;
    }
    case 'unit.save': case 'year.save': { permit('admin.manage'); const list = command.type === 'unit.save' ? s.units : s.years; const v = command.value; requireRule(textValid(v.name, 120), 'Nhập tên hợp lệ (tối đa 120 ký tự).'); requireRule(!list.some(i => i.id !== v.id && i.name.toLocaleLowerCase() === v.name.trim().toLocaleLowerCase()), 'Tên đã tồn tại.'); if (v.id) { const item = list.find(i => i.id === v.id); requireRule(item, 'Không tìm thấy danh mục.'); item.name = v.name.trim(); } else list.push({ id: id(), name: v.name.trim() }); break; }
  }
  const entityType = command.type.split('.')[0];
  const lists = { plan: s.plans, task: s.tasks, indicator: s.indicators, strategy: s.strategies, user: s.users, unit: s.units, year: s.years };
  const oldLists = { plan: store.plans, task: store.tasks, indicator: store.indicators, strategy: store.strategies, user: store.users, unit: store.units, year: store.years };
  const list = lists[entityType as keyof typeof lists]; const oldList = oldLists[entityType as keyof typeof oldLists];
  const recordId = 'id' in command ? command.id : 'id' in command.value ? command.value.id : undefined;
  const record = recordId ? list?.find(i => i.id === recordId) : list?.find(i => !oldList?.some(old => old.id === i.id));
  const detail = command.type === 'plan.review' ? command.approved ? 'Đã phê duyệt kế hoạch.' : `Yêu cầu chỉnh sửa: ${command.reason?.trim()}` : command.type === 'task.review' ? command.accepted ? 'Đã nghiệm thu nhiệm vụ.' : `Yêu cầu bổ sung: ${command.reason?.trim()}` : command.type === 'indicator.review' ? command.published ? 'Đã duyệt và công bố kết quả.' : `Yêu cầu đánh giá lại: ${command.reason?.trim()}` : command.type === 'task.update' ? `Tiến độ ${command.progress}%. ${command.submit ? 'Đã gửi nghiệm thu.' : 'Đã lưu tiến độ.'}` : undefined;
  s.logs.unshift({ id: id(), actor: actor.name, action: command.type, time: new Date().toISOString(), entityType, entityId: record?.id, title: record && ('title' in record ? record.title : record.name), detail });
  return s;
}
