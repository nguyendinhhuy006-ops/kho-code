import { createHash } from 'node:crypto';
import { canVisit, hasPermission, visiblePlans, type Command, type Plan, type Store, type User } from '../src/shared/domain.ts';

export function apiError(message: string, status: number, code: string): never {
  throw Object.assign(new Error(message), { status, code });
}
export const planVersion = (plan: Plan) => createHash('sha256').update(JSON.stringify(plan)).digest('hex');
export function findPlan(store: Store, user: User, id: string) {
  const plan = visiblePlans(store, user).find(item => item.id === id);
  if (!plan) apiError('Không tìm thấy kế hoạch.', 404, 'PLAN_NOT_FOUND');
  return plan;
}
export function listPlans(store: Store, user: User, query: URLSearchParams) {
  if (!canVisit(user, 'plans', store)) apiError('Bạn không có quyền xem kế hoạch.', 403, 'FORBIDDEN');
  const integer = (key: string, fallback: number, max: number) => {
    const raw = query.get(key);
    if (raw === null) return fallback;
    if (!/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(Number(raw)) || Number(raw) > max) apiError(`Tham số ${key} không hợp lệ.`, 422, 'INVALID_QUERY');
    return Number(raw);
  };
  const page = integer('page', 1, 1_000_000);
  const pageSize = integer('pageSize', 20, 100);
  const status = query.get('status');
  if (status && !['draft', 'submitted', 'approved', 'returned'].includes(status)) apiError('Trạng thái không hợp lệ.', 422, 'INVALID_QUERY');
  const search = query.get('q')?.trim().toLocaleLowerCase('vi') ?? '';
  const rows = visiblePlans(store, user).filter(p => (!status || p.status === status) && (!query.get('unitId') || p.unitId === query.get('unitId')) && (!query.get('yearId') || p.yearId === query.get('yearId')) && p.title.toLocaleLowerCase('vi').includes(search));
  return { items: rows.slice((page - 1) * pageSize, page * pageSize).map(p => ({ ...p, version: planVersion(p) })), page, pageSize, total: rows.length };
}
export function planCommand(store: Store, user: User, method: string, id: string | undefined, action: string | undefined, input: Record<string, unknown>): Command {
  const permission = action === 'submit' ? 'plan.submit' : action === 'review' ? 'plan.review' : 'plan.create';
  if (!hasPermission(user, permission, store)) apiError('Bạn không có quyền thực hiện thao tác này.', 403, 'FORBIDDEN');
  let old: Plan | undefined;
  if (id) {
    old = findPlan(store, user, id);
    if (typeof input.version !== 'string') apiError('Cần gửi phiên bản kế hoạch.', 422, 'VERSION_REQUIRED');
    if (input.version !== planVersion(old)) apiError('Kế hoạch đã thay đổi. Tải lại trước khi lưu.', 409, 'VERSION_CONFLICT');
  }
  if (method === 'POST' && action === 'submit' && id) return { type: 'plan.submit', id };
  if (method === 'POST' && action === 'review' && id) {
    if (typeof input.approved !== 'boolean' || (input.reason !== undefined && typeof input.reason !== 'string')) apiError('Kết quả duyệt không hợp lệ.', 422, 'INVALID_INPUT');
    return { type: 'plan.review', id, approved: input.approved, reason: input.reason as string | undefined };
  }
  if ((!id && method === 'POST') || (id && method === 'PATCH' && !action)) {
    const value: Record<string, unknown> = old ? { ...old } : {};
    for (const key of ['title', 'yearId', 'strategyId', 'objective', 'deliverables', 'startDate', 'endDate', 'reference']) {
      if (input[key] !== undefined) {
        if (typeof input[key] !== 'string') apiError(`Trường ${key} phải là chuỗi.`, 422, 'INVALID_INPUT');
        value[key] = input[key];
      }
    }
    if (typeof value.title !== 'string' || typeof value.yearId !== 'string') apiError('Tên và năm học là bắt buộc.', 422, 'INVALID_INPUT');
    return { type: 'plan.save', value: { ...value, id } as Extract<Command, { type: 'plan.save' }>['value'] };
  }
  return apiError('Phương thức không được hỗ trợ.', 405, 'METHOD_NOT_ALLOWED');
}
