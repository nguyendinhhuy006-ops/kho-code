import { useState, type ReactNode } from 'react';
import { Alert, Card, Col, Row, Segmented, Statistic, Table, Tag } from 'antd';
import { isOverdue, type Task } from '../shared/domain';
import { formatDate, Percent, Status, TitleCell } from '../shared/ui';

export function AlertQueue({ tasks, userName, renderActions }: { tasks: Task[]; userName: (id: string) => string; renderActions: (task: Task) => ReactNode }) {
  const [group, setGroup] = useState('overdue');
  const today = new Date().toLocaleDateString('sv-SE'); const soonDate = new Date(); soonDate.setDate(soonDate.getDate() + 7);
  const groups = [
    { value: 'overdue', label: 'Quá hạn', items: tasks.filter(isOverdue), color: '#ce6751', guidance: 'Ưu tiên trao đổi với người thực hiện, rà soát sản phẩm còn thiếu và cập nhật kết quả xử lý trước khi gửi nghiệm thu.' },
    { value: 'soon', label: 'Đến hạn trong 7 ngày', items: tasks.filter(t => t.status !== 'accepted' && t.due >= today && t.due <= soonDate.toLocaleDateString('sv-SE')), color: '#d89c27', guidance: 'Kiểm tra phần việc còn lại, chuẩn bị sản phẩm bàn giao và bổ sung tham chiếu minh chứng trước thời hạn.' },
    { value: 'revision', label: 'Cần bổ sung', items: tasks.filter(t => t.status === 'revision'), color: '#bd7c38', guidance: 'Đọc yêu cầu của người nghiệm thu, bổ sung sản phẩm và minh chứng, sau đó gửi nghiệm thu lại khi hoàn thành.' },
    { value: 'review', label: 'Chờ nghiệm thu', items: tasks.filter(t => t.status === 'review'), color: '#1467b4', guidance: 'Đối chiếu sản phẩm với yêu cầu công việc, kiểm tra minh chứng và xác nhận nghiệm thu hoặc nêu rõ nội dung cần bổ sung.' },
  ];
  const selected = groups.find(g => g.value === group)!;
  return <><Row gutter={[16, 16]} className="stats-row">{groups.map(g => <Col xs={12} xl={6} key={g.value}><Card className="alert-stat"><Statistic title={g.label} value={g.items.length} styles={{ content: { color: g.color } }} /></Card></Col>)}</Row>
    <Card><div className="alert-segments"><Segmented aria-label="Nhóm cảnh báo" value={group} onChange={v => setGroup(String(v))} options={groups.map(g => ({ value: g.value, label: `${g.label} (${g.items.length})` }))} /></div><Alert className="section-note" type={group === 'overdue' ? 'warning' : 'info'} showIcon title={selected.label} description={selected.guidance} />
      <Table rowKey="id" dataSource={selected.items} scroll={{ x: 1000 }} columns={[
        { title: 'Nhiệm vụ cần theo dõi', dataIndex: 'title', render: (_: string, t: Task) => <TitleCell title={t.title} subtitle={t.reason ?? t.expectedOutput} /> },
        { title: 'Người thực hiện', dataIndex: 'assigneeId', render: userName },
        { title: 'Hạn / thời gian còn lại', dataIndex: 'due', render: (due: string, t: Task) => { const days = Math.round((Date.parse(due) - Date.parse(today)) / 86_400_000); return <div>{formatDate(due)}<small className="block"><Tag color={isOverdue(t) ? 'red' : 'gold'}>{days < 0 ? `Quá ${-days} ngày` : days === 0 ? 'Đến hạn hôm nay' : `Còn ${days} ngày`}</Tag></small></div>; } },
        { title: 'Tiến độ', dataIndex: 'progress', width: 120, render: (value: number) => <Percent value={value} /> },
        { title: 'Trạng thái', dataIndex: 'status', render: (value: string) => <Status value={value} /> },
        { title: 'Xem / xử lý', render: (_: unknown, t: Task) => renderActions(t) },
      ]} locale={{ emptyText: `Không có nhiệm vụ thuộc nhóm ${selected.label.toLocaleLowerCase('vi')}.` }} />
    </Card><p className="form-footnote section-gap">Cảnh báo được xác định từ thời hạn và trạng thái hiện tại. Một nhiệm vụ có thể đồng thời thuộc nhóm quá hạn và nhóm chờ nghiệm thu hoặc cần bổ sung.</p></>;
}
