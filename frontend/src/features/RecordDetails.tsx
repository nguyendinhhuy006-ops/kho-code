import type { ReactNode } from 'react';
import { Alert, Descriptions, Drawer, Empty, Progress, Tag, Timeline } from 'antd';
import { useStore } from '../app/store';
import { visibleIndicators, visiblePlans, visibleTasks, type User } from '../shared/domain';
import { actionNames, priorityNames } from '../shared/content';
import { formatDate, Status } from '../shared/ui';

export type DetailSelection = { kind: 'plan' | 'task' | 'indicator' | 'strategy'; id: string };
export function RecordDetails({ selection, user, onClose, actions }: { selection: DetailSelection | null; user: User; onClose: () => void; actions?: ReactNode }) {
  const { data } = useStore();
  if (!selection) return null;
  const plan = selection.kind === 'plan' ? visiblePlans(data, user).find(p => p.id === selection.id) : undefined;
  const task = selection.kind === 'task' ? visibleTasks(data, user).find(t => t.id === selection.id) : undefined;
  const indicator = selection.kind === 'indicator' ? visibleIndicators(data, user).find(i => i.id === selection.id) : undefined;
  const strategy = selection.kind === 'strategy' && ['BGH', 'TDV'].includes(user.role) ? data.strategies.find(s => s.id === selection.id) : undefined;
  const record = plan ?? task ?? indicator ?? strategy;
  const unitName = (id?: string) => data.units.find(u => u.id === id)?.name ?? 'Chưa xác định';
  const userName = (id: string) => data.users.find(u => u.id === id)?.name ?? 'Chưa xác định';
  const text = (value?: string) => value?.trim() || 'Chưa bổ sung thông tin.';
  const history = data.logs.filter(l => l.entityType === selection.kind && l.entityId === selection.id).slice().reverse();
  return <Drawer title={<span id="record-detail-heading">Hồ sơ chi tiết</span>} aria-labelledby="record-detail-heading" open onClose={onClose} size={700} className="record-drawer">
    {!record ? <Empty description="Không tìm thấy hồ sơ trong phạm vi quyền của bạn." /> : <>
      <div className="detail-record-id">MÃ ĐỊNH DANH · {record.id}</div><h2 className="detail-record-title">{record.title}</h2>
      {'status' in record && <Status value={record.status} />}
      {'reason' in record && record.reason && <Alert className="section-gap" showIcon type="warning" title="Yêu cầu cần xử lý" description={record.reason} />}
      <h3 className="detail-section-heading">Thông tin chung</h3>
      <Descriptions column={1} size="small" bordered items={plan ? [
        { key: 'unit', label: 'Đơn vị thực hiện', children: unitName(plan.unitId) },
        { key: 'year', label: 'Năm học', children: data.years.find(y => y.id === plan.yearId)?.name },
        { key: 'strategy', label: 'Mục tiêu chiến lược', children: data.strategies.find(s => s.id === plan.strategyId)?.title ?? 'Chưa liên kết' },
        { key: 'time', label: 'Thời gian thực hiện', children: plan.startDate && plan.endDate ? `${formatDate(plan.startDate)} – ${formatDate(plan.endDate)}` : 'Chưa xác định' },
        { key: 'tasks', label: 'Nhiệm vụ triển khai', children: `${data.tasks.filter(t => t.planId === plan.id).length} nhiệm vụ` },
      ] : task ? [
        { key: 'plan', label: 'Kế hoạch liên quan', children: data.plans.find(p => p.id === task.planId)?.title },
        { key: 'user', label: 'Người thực hiện', children: userName(task.assigneeId) },
        { key: 'unit', label: 'Đơn vị', children: unitName(data.plans.find(p => p.id === task.planId)?.unitId) },
        { key: 'priority', label: 'Mức độ ưu tiên', children: <Tag color={task.priority === 'urgent' ? 'red' : task.priority === 'high' ? 'orange' : 'blue'}>{priorityNames[task.priority ?? 'normal']}</Tag> },
        { key: 'start', label: 'Ngày bắt đầu', children: task.startDate ? formatDate(task.startDate) : 'Chưa xác định' },
        { key: 'due', label: 'Hạn hoàn thành', children: formatDate(task.due) },
        { key: 'progress', label: 'Tiến độ thực hiện', children: <Progress percent={task.progress} size="small" /> },
      ] : indicator ? [
        { key: 'owner', label: 'Người thực hiện', children: userName(indicator.userId) },
        { key: 'period', label: 'Kỳ thực hiện', children: text(indicator.period) },
        { key: 'target', label: 'Mục tiêu được giao', children: `${indicator.target} ${indicator.unit}` },
        { key: 'actual', label: 'Kết quả thực hiện', children: `${indicator.actual} ${indicator.unit}` },
        { key: 'ratio', label: 'Tỷ lệ đạt chỉ tiêu', children: `${Math.round(indicator.actual / indicator.target * 100)}% (kết quả / mục tiêu)` },
      ] : [
        { key: 'period', label: 'Giai đoạn triển khai', children: text(strategy?.period) },
        { key: 'owner', label: 'Đơn vị chủ trì', children: unitName(strategy?.ownerUnitId) },
        { key: 'linked', label: 'Kế hoạch liên kết', children: `${data.plans.filter(p => p.strategyId === strategy?.id).length} kế hoạch trong phạm vi theo dõi` },
      ]} />
      {plan && <><DetailText title="Căn cứ lập kế hoạch" value={text(plan.reference)} /><DetailText title="Mục tiêu thực hiện" value={text(plan.objective)} /><DetailText title="Sản phẩm và kết quả cần đạt" value={text(plan.deliverables)} /></>}
      {task && <><DetailText title="Nội dung và yêu cầu công việc" value={text(task.description)} /><DetailText title="Sản phẩm bàn giao / tiêu chí nghiệm thu" value={text(task.expectedOutput)} /><DetailText title="Kết quả cập nhật và tham chiếu minh chứng" value={text(task.evidence)} /></>}
      {indicator && <><DetailText title="Cách xác định kết quả" value={text(indicator.measurement)} /><DetailText title="Minh chứng / tài liệu đối chiếu" value={text(indicator.evidence)} /><Alert showIcon type="info" title={indicator.status === 'published' ? 'Kết quả đầu vào đã được duyệt và công bố.' : 'Kết quả đang trong quá trình cập nhật, chưa phải kết quả chính thức.'} description="Tỷ lệ đạt chỉ tiêu chỉ phản ánh kết quả so với mục tiêu, chưa phải điểm KPI hoặc xếp loại." /></>}
      {strategy && <><DetailText title="Nội dung định hướng" value={strategy.description} /><DetailText title="Kết quả kỳ vọng" value={text(strategy.expectedOutcome)} /></>}
      <h3 className="detail-section-heading">Lịch sử xử lý hồ sơ</h3>
      {history.length ? <Timeline items={history.map(h => ({ title: new Date(h.time).toLocaleString('vi-VN'), content: <div><strong>{actionNames[h.action] ?? h.action}</strong><p>{h.actor}</p>{h.detail && <p>{h.detail}</p>}</div> }))} /> : <p className="detail-empty">Chưa có thao tác được ghi nhận cho hồ sơ này.</p>}
      {actions && <div className="detail-actions">{actions}</div>}
    </>}
  </Drawer>;
}
function DetailText({ title, value }: { title: string; value: string }) { return <section className="detail-text"><h3>{title}</h3><p>{value}</p></section>; }
