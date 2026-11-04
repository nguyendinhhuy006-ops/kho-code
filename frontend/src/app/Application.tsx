import { useState } from 'react';
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Alert, App, Avatar, Button, Drawer, Form, Input, Modal, Spin, Tag, Tooltip } from 'antd';
import { ApartmentOutlined, BarChartOutlined, BellOutlined, CalendarOutlined, CheckSquareOutlined, DashboardOutlined, FileTextOutlined, FlagOutlined, HistoryOutlined, LockOutlined, LogoutOutlined, MailOutlined, MenuOutlined, SafetyCertificateOutlined, TeamOutlined } from '@ant-design/icons';
import { useStore } from './store';
import { canVisit, pages, roleNames, type Page, type Role, type User } from '../shared/domain';
import { Workspace } from '../features/Workspace';

const icons = { dashboard: DashboardOutlined, strategy: FlagOutlined, plans: CalendarOutlined, tasks: CheckSquareOutlined, performance: BarChartOutlined, alerts: BellOutlined, reports: FileTextOutlined, accounts: TeamOutlined, units: ApartmentOutlined, years: CalendarOutlined, roles: SafetyCertificateOutlined, logs: HistoryOutlined };

function Login() {
  const { data, login, userId, warning } = useStore(); const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false); const [error, setError] = useState('');
  if (data.users.some(u => u.id === userId && u.active)) return <Navigate to="/dashboard" replace />;
  return <main className="login-page">
    <section className="login-story"><div className="brand"><img className="university-logo" src="/branding/image1.png" alt="Logo Đại học Hải Phòng" /><div>Đại học Hải Phòng<small>HAIPHONG UNIVERSITY</small></div></div><div className="login-intro"><Tag color="blue">HỆ THỐNG QUẢN TRỊ ĐIỀU HÀNH</Tag><h1>Kết nối mục tiêu.<br />Nâng cao hiệu quả.</h1><p>Theo dõi kế hoạch, phối hợp thực hiện nhiệm vụ và nhìn rõ kết quả trong một không gian thống nhất.</p><div className="login-points"><span>01 <b>Kế hoạch rõ ràng</b></span><span>02 <b>Tiến độ minh bạch</b></span><span>03 <b>Đánh giá nhất quán</b></span></div></div><small>Trường Đại học Hải Phòng · Hệ thống quản trị nội bộ</small></section>
    <section className="login-form"><div className="login-form-inner"><div className="login-wordmark">QUANTRIKPI <span>·</span> CỔNG NỘI BỘ</div><h2>Đăng nhập hệ thống</h2><p>Sử dụng tài khoản được cấp để truy cập không gian làm việc của bạn.</p>{(error || warning) && <Alert className="login-error" type="error" showIcon title={error || warning} role="alert" />}<Form layout="vertical" requiredMark={false} onFinish={async ({ email, password }) => { if (submitting) return; setSubmitting(true); setError(''); try { await login(email, password); navigate('/dashboard', { replace: true }); } catch (e) { setError((e as Error).message); } finally { setSubmitting(false); } }}><Form.Item name="email" label="Email đăng nhập" rules={[{ required: true, message: 'Vui lòng nhập email đăng nhập.' }, { type: 'email', message: 'Email chưa đúng định dạng.' }]}><Input size="large" prefix={<MailOutlined />} placeholder="Nhập email của bạn" autoComplete="username" maxLength={200} autoCapitalize="none" spellCheck={false} /></Form.Item><Form.Item name="password" label="Mật khẩu" rules={[{ required: true, message: 'Vui lòng nhập mật khẩu.' }]}><Input.Password size="large" prefix={<LockOutlined />} placeholder="Nhập mật khẩu" autoComplete="current-password" maxLength={128} /></Form.Item><div className="login-support"><span>Quên mật khẩu?</span> Liên hệ quản trị viên để được cấp lại.</div><Button type="primary" htmlType="submit" size="large" loading={submitting} block>Đăng nhập</Button></Form><div className="login-foot"><SafetyCertificateOutlined /> Truy cập theo tài khoản và phạm vi được phân quyền</div><div className="login-copyright">© {new Date().getFullYear()} Trường Đại học Hải Phòng</div></div></section>
  </main>;
}

function RouteContent({ user }: { user: User }) {
  const { page } = useParams(); const { data } = useStore();
  if (!pages.some(p => p.key === page)) return <section className="empty-page"><h1>Không tìm thấy trang</h1><p>Đường dẫn này không tồn tại.</p><NavLink to="/dashboard">Trở về tổng quan</NavLink></section>;
  if (!canVisit(user, page as Page, data)) return <section className="empty-page"><SafetyCertificateOutlined /><h1>Không đủ quyền truy cập</h1><p>Vai trò {roleNames[user.role]} không được truy cập chức năng này.</p><NavLink to="/dashboard">Trở về tổng quan</NavLink></section>;
  return <Workspace key={`${user.id}-${page}`} user={user} page={page as Page} />;
}

function Shell({ user }: { user: User }) {
  const { data, logout, warning, changePassword } = useStore(); const { message } = App.useApp(); const [passwordOpen, setPasswordOpen] = useState(false); const [passwordSaving, setPasswordSaving] = useState(false); const [passwordForm] = Form.useForm(); const [drawer, setDrawer] = useState(false); const location = useLocation(); const navigate = useNavigate();
  const currentPage = location.pathname.split('/')[1]; const current = pages.find(p => p.key === currentPage);
  const nav = <>
    <div className="brand"><img className="university-logo" src="/branding/image1.png" alt="Logo Đại học Hải Phòng" /><div>QuanTriKPI<small>ĐẠI HỌC HẢI PHÒNG</small></div></div>
    <div className="nav-heading">KHÔNG GIAN LÀM VIỆC</div>
    <nav aria-label="Điều hướng chính">{pages.filter(p => canVisit(user, p.key, data)).map(p => { const Icon = icons[p.key]; return <NavLink key={p.key} to={`/${p.key}`} onClick={() => setDrawer(false)}><Icon /><span>{p.key === 'tasks' && user.role === 'GV' ? 'Nhiệm vụ của tôi' : p.label}</span></NavLink>; })}</nav>
    <div className="sidebar-bottom"><div className="role-label"><SafetyCertificateOutlined /><div><small>VAI TRÒ HIỆN TẠI</small><strong>{roleNames[user.role]}</strong></div></div><button onClick={() => { setPasswordOpen(true); setDrawer(false); }}><LockOutlined /> Đổi mật khẩu</button><button onClick={async () => { try { await logout(); navigate('/login', { replace: true }); } catch (e) { message.error((e as Error).message); } }}><LogoutOutlined /> Đăng xuất</button></div>
  </>;
  return <div className="app-shell">
    <aside className="sidebar">{nav}</aside>
    <Drawer placement="left" open={drawer} onClose={() => setDrawer(false)} size={270} styles={{ body: { padding: 0, background: '#0b3a70' } }}><div className="drawer-nav">{nav}</div></Drawer>
    <div className="main-shell"><header className="topbar"><div className="topbar-path"><Button className="mobile-menu" type="text" icon={<MenuOutlined />} onClick={() => setDrawer(true)} aria-label="Mở menu" /><span>Không gian làm việc <b>/</b> <strong>{current?.label ?? 'Trang'}</strong></span></div><div className="profile">{canVisit(user, 'alerts', data) && <Tooltip title="Cảnh báo tiến độ"><Button type="text" icon={<BellOutlined />} onClick={() => navigate('/alerts')} aria-label="Xem cảnh báo" /></Tooltip>}<Avatar style={{ background: '#e8f1fb', color: '#1467b4' }}>{user.name.split(' ').slice(-2).map(t => t[0]).join('')}</Avatar><div><strong>{user.name}</strong><small>{data.units.find(u => u.id === user.unitId)?.name}</small></div></div></header><main className="content">{warning && <Alert className="storage-warning" type="warning" showIcon title={warning} />}<RouteContent user={user} /></main><footer>QuanTriKPI <span>Quản trị điều hành & theo dõi hiệu quả thực hiện nhiệm vụ</span></footer></div>
    <Modal title="Đổi mật khẩu" open={passwordOpen} onCancel={() => { setPasswordOpen(false); passwordForm.resetFields(); }} okText="Lưu mật khẩu" cancelText="Hủy" confirmLoading={passwordSaving} onOk={() => passwordForm.submit()}>
      <Form form={passwordForm} layout="vertical" onFinish={async v => { setPasswordSaving(true); try { await changePassword(v.current, v.next); message.success('Đã đổi mật khẩu. Các phiên đăng nhập khác đã kết thúc.'); setPasswordOpen(false); passwordForm.resetFields(); } catch (e) { message.error((e as Error).message); } finally { setPasswordSaving(false); } }}>
        <Form.Item name="current" label="Mật khẩu hiện tại" rules={[{ required: true, message: 'Nhập mật khẩu hiện tại.' }]}><Input.Password autoComplete="current-password" maxLength={128} /></Form.Item>
        <Form.Item name="next" label="Mật khẩu mới" rules={[{ required: true, message: 'Nhập mật khẩu mới.' }, { min: 12, max: 128, message: 'Mật khẩu cần có từ 12 đến 128 ký tự.' }]}><Input.Password autoComplete="new-password" maxLength={128} /></Form.Item>
        <Form.Item name="confirm" label="Xác nhận mật khẩu mới" dependencies={['next']} rules={[{ required: true, message: 'Xác nhận mật khẩu mới.' }, ({ getFieldValue }) => ({ validator(_, value) { return !value || getFieldValue('next') === value ? Promise.resolve() : Promise.reject(new Error('Mật khẩu xác nhận chưa khớp.')); } })]}><Input.Password autoComplete="new-password" maxLength={128} /></Form.Item>
      </Form>
    </Modal>
  </div>;
}

export function Application() {
  const { data, userId, loading } = useStore(); if (loading) return <div className="loading-screen"><Spin size="large" description="Đang tải phiên làm việc…" /></div>; const user = data.users.find(u => u.id === userId && u.active);
  return <Routes><Route path="/login" element={<Login />} /><Route path="/" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} /><Route path="/:page" element={user ? <Shell user={user} /> : <Navigate to="/login" replace />} /><Route path="*" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} /></Routes>;
}
