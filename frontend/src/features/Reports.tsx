import { useState } from 'react';
import { Alert, Button, Card, Col, Row, Select, Statistic, Table, Tag } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { useStore } from '../app/store';
import { isOverdue, visiblePlans, visibleTasks, type Task, type User } from '../shared/domain';
import { formatDate, Percent, Status, statuses, TitleCell } from '../shared/ui';

export function Reports({ user, onDetail }: { user: User; onDetail: (id: string) => void }) {
  const { data } = useStore(); const [yearId, setYearId] = useState<string>(); const [unitId, setUnitId] = useState<string>();
  const allPlans = visiblePlans(data, user);
  const plans = allPlans.filter(p => (!yearId || p.yearId === yearId) && (!unitId || p.unitId === unitId));
  const tasks = visibleTasks(data, user).filter(t => plans.some(p => p.id === t.planId));
  const accepted = tasks.filter(t => t.status === 'accepted').length;
  const progress = tasks.length ? tasks.reduce((sum, t) => sum + t.progress, 0) / tasks.length : 0;
  const unitName = (id: string) => data.units.find(u => u.id === id)?.name ?? id;
  const userName = (id: string) => data.users.find(u => u.id === id)?.name ?? id;
  const availableUnits = data.units.filter(u => user.role === 'TDV' ? u.id === user.unitId : allPlans.some(p => p.unitId === u.id));
  const summary = availableUnits.filter(u => !unitId || u.id === unitId).map(u => {
    const scopedPlans = plans.filter(p => p.unitId === u.id); const scopedTasks = tasks.filter(t => scopedPlans.some(p => p.id === t.planId));
    return { id: u.id, name: u.name, plans: scopedPlans.length, total: scopedTasks.length, accepted: scopedTasks.filter(t => t.status === 'accepted').length, pending: scopedTasks.filter(t => t.status === 'review').length, overdue: scopedTasks.filter(isOverdue).length, progress: scopedTasks.length ? scopedTasks.reduce((s, t) => s + t.progress, 0) / scopedTasks.length : 0 };
  });
  function exportCSV() {
    const escape = (v: string | number) => `"${String(typeof v === 'string' && /^[=+@\-\t\r\n]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`;
    const rows = [['Nhiệm vụ', 'Kế hoạch', 'Năm học', 'Đơn vị', 'Người thực hiện', 'Hạn hoàn thành', 'Tiến độ (%)', 'Trạng thái', 'Minh chứng tham chiếu'], ...tasks.map(t => {
      const p = plans.find(p => p.id === t.planId)!;
      return [t.title, p.title, data.years.find(y => y.id === p.yearId)?.name ?? p.yearId, unitName(p.unitId), userName(t.assigneeId), t.due, t.progress, statuses[t.status]?.label ?? t.status, t.evidence];
    })];
    const blob = new Blob(['\uFEFF' + rows.map(row => row.map(escape).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'bao-cao-nhiem-vu.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <>
    <Card className="section-note"><div className="report-toolbar"><div className="report-filter"><label htmlFor="report-year">Năm học</label><Select id="report-year" value={yearId} onChange={setYearId} placeholder="Tất cả năm học" allowClear options={data.years.map(y => ({ value: y.id, label: y.name }))} /></div><div className="report-filter"><label htmlFor="report-unit">Đơn vị thực hiện</label><Select id="report-unit" value={unitId} onChange={setUnitId} placeholder="Tất cả đơn vị trong phạm vi" allowClear options={availableUnits.map(u => ({ value: u.id, label: u.name }))} /></div><Button onClick={() => { setYearId(undefined); setUnitId(undefined); }}>Xóa bộ lọc</Button><Button type="primary" icon={<DownloadOutlined />} onClick={exportCSV}>Xuất CSV</Button></div></Card>
    <Row gutter={[16, 16]} className="stats-row">{[{ title: 'Kế hoạch theo bộ lọc', value: plans.length }, { title: 'Nhiệm vụ theo bộ lọc', value: tasks.length }, { title: 'Tỷ lệ đã nghiệm thu', value: tasks.length ? Math.round(accepted / tasks.length * 100) : 0, suffix: '%' }, { title: 'Tiến độ trung bình', value: Math.round(progress), suffix: '%' }].map(s => <Col xs={12} xl={6} key={s.title}><Card><Statistic {...s} /></Card></Col>)}</Row>
    <Card title="Tổng hợp thực hiện theo đơn vị" extra={<Tag>{tasks.length} nhiệm vụ</Tag>}><Table rowKey="id" pagination={false} scroll={{ x: 850 }} dataSource={summary} columns={[{ title: 'Đơn vị', dataIndex: 'name' }, { title: 'Kế hoạch', dataIndex: 'plans' }, { title: 'Nhiệm vụ', dataIndex: 'total' }, { title: 'Đã nghiệm thu', dataIndex: 'accepted' }, { title: 'Chờ nghiệm thu', dataIndex: 'pending' }, { title: 'Quá hạn', dataIndex: 'overdue' }, { title: 'Tiến độ TB', dataIndex: 'progress', width: 130, render: (v: number) => <Percent value={v} /> }]} /></Card>
    <Card className="section-gap" title="Danh sách đối chiếu báo cáo"><Table rowKey="id" scroll={{ x: 900 }} dataSource={tasks} columns={[{ title: 'Nhiệm vụ / kế hoạch', dataIndex: 'title', render: (_: string, t: Task) => <TitleCell title={t.title} subtitle={plans.find(p => p.id === t.planId)?.title} /> }, { title: 'Người thực hiện', dataIndex: 'assigneeId', render: userName }, { title: 'Hạn hoàn thành', dataIndex: 'due', render: formatDate }, { title: 'Tiến độ', dataIndex: 'progress', width: 120, render: (v: number) => <Percent value={v} /> }, { title: 'Trạng thái', dataIndex: 'status', render: (v: string) => <Status value={v} /> }, { title: 'Thao tác', render: (_: unknown, t: Task) => <Button size="small" onClick={() => onDetail(t.id)}>Xem chi tiết</Button> }]} locale={{ emptyText: 'Không có nhiệm vụ trong năm học và đơn vị đang chọn.' }} /></Card>
    <Alert className="section-gap" showIcon type="info" title="Cách đọc báo cáo" description="Tiến độ trung bình là trung bình cộng tiến độ các nhiệm vụ đang lọc. Tỷ lệ đã nghiệm thu là số nhiệm vụ được xác nhận chia tổng số nhiệm vụ. Số quá hạn tính theo ngày hiện tại, loại trừ nhiệm vụ đã nghiệm thu. Tệp CSV chứa đúng danh sách đối chiếu trên màn hình." />
  </>;
}
