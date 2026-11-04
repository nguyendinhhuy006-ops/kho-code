import { Button, Card, Tag } from 'antd';
import { ArrowRightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../app/store';
import { visibleIndicators, visiblePlans, visibleTasks, type User } from '../shared/domain';

export function WorkQueue({ user }: { user: User }) {
  const { data } = useStore(); const navigate = useNavigate();
  const plans = visiblePlans(data, user); const tasks = visibleTasks(data, user); const indicators = visibleIndicators(data, user);
  const rows = user.role === 'BGH' ? [
    { title: 'Kế hoạch chờ phê duyệt', note: 'Kiểm tra mục tiêu, kết quả và thời gian thực hiện của đơn vị.', count: plans.filter(p => p.status === 'submitted').length, path: '/plans' },
    { title: 'Kết quả chỉ tiêu chờ công bố', note: 'Đối chiếu kết quả đã trình với mục tiêu và hồ sơ minh chứng.', count: indicators.filter(i => i.status === 'submitted').length, path: '/performance' },
  ] : user.role === 'TDV' ? [
    { title: 'Hồ sơ nhiệm vụ chờ nghiệm thu', note: 'Xác nhận sản phẩm bàn giao hoặc yêu cầu bổ sung rõ nội dung.', count: tasks.filter(t => t.status === 'review').length, path: '/tasks' },
    { title: 'Kế hoạch cần chỉnh sửa', note: 'Bổ sung theo ý kiến Ban Giám hiệu và trình lại.', count: plans.filter(p => p.status === 'returned').length, path: '/plans' },
    { title: 'Kết quả chỉ tiêu chưa trình', note: 'Rà soát số liệu và minh chứng trước khi gửi phê duyệt.', count: indicators.filter(i => i.status === 'draft').length, path: '/performance' },
  ] : user.role === 'GV' ? [
    { title: 'Nhiệm vụ được yêu cầu bổ sung', note: 'Đọc nhận xét, hoàn thiện sản phẩm và gửi nghiệm thu lại.', count: tasks.filter(t => t.status === 'revision').length, path: '/tasks' },
    { title: 'Chỉ tiêu đang cập nhật', note: 'Bổ sung kết quả thực hiện và hồ sơ để đơn vị đối chiếu.', count: indicators.filter(i => i.status === 'draft').length, path: '/performance' },
  ] : [
    { title: 'Tài khoản đang tạm khóa', note: 'Kiểm tra trạng thái và điều chỉnh khi có yêu cầu được phê duyệt.', count: data.users.filter(u => !u.active).length, path: '/accounts' },
    { title: 'Danh mục đơn vị', note: 'Đảm bảo tên đơn vị thống nhất trước khi gán tài khoản.', count: data.units.length, path: '/units' },
  ];
  return <Card title="Công việc theo thẩm quyền" className="section-note"><div className="work-queue">{rows.map(row => <div key={row.title} className="work-queue-row"><div><strong>{row.title} <Tag color={row.count ? 'blue' : 'default'}>{row.count}</Tag></strong><p>{row.note}</p></div><Button size="small" onClick={() => navigate(row.path)}>Mở danh sách <ArrowRightOutlined /></Button></div>)}</div></Card>;
}
