import { useEffect, useState } from 'react';
import { Alert, App, Button, Card, Input, Modal, Space, Switch, Table, Tag } from 'antd';
import { useStore } from '../app/store';
import { defaultAccess, pages, permissionNames, permissionPages, roleNames, roles, type AccessPolicy, type Page, type Permission, type Role } from '../shared/domain';

export function RoleMatrix() {
  const { data, dispatch } = useStore(); const { message, modal } = App.useApp();
  const [draft, setDraft] = useState<AccessPolicy>(() => structuredClone(data.access ?? defaultAccess()));
  const [reason, setReason] = useState(''); const [open, setOpen] = useState(false); const [saving, setSaving] = useState(false);
  const saved = data.access ?? defaultAccess();
  const dirty = JSON.stringify(draft.roles) !== JSON.stringify(saved.roles);
  useEffect(() => { const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); }; if (dirty) window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn); }, [dirty]);
  const changes = roles.flatMap(role => (['pages', 'permissions'] as const).flatMap(kind => {
    const keys = kind === 'pages' ? pages.map(p => p.key) : Object.keys(permissionNames);
    return keys.filter(key => (draft.roles[role][kind] as string[]).includes(key) !== (saved.roles[role][kind] as string[]).includes(key)).map(key => `${roleNames[role]} · ${kind === 'pages' ? pages.find(p => p.key === key)?.label : permissionNames[key as Permission]}: ${(draft.roles[role][kind] as string[]).includes(key) ? 'Bật' : 'Tắt'}`);
  }));
  function toggle(role: Role, kind: 'pages' | 'permissions', key: Page | Permission, enabled: boolean) {
    setDraft(current => { const next = structuredClone(current); const entry = next.roles[role];
      if (kind === 'pages') { entry.pages = enabled ? [...entry.pages, key as Page] : entry.pages.filter(p => p !== key); if (!enabled) entry.permissions = entry.permissions.filter(p => permissionPages[p] !== key); }
      else { entry.permissions = enabled ? [...entry.permissions, key as Permission] : entry.permissions.filter(p => p !== key); if (enabled && !entry.pages.includes(permissionPages[key as Permission])) entry.pages.push(permissionPages[key as Permission]); }
      return next;
    });
  }
  const columns = (kind: 'pages' | 'permissions') => [{ title: 'Chức năng / quyền', dataIndex: 'label', width: 300 }, ...roles.map(role => ({ title: roleNames[role], key: role, render: (_: unknown, row: { key: string; label: string }) => {
    return <Switch aria-label={`${roleNames[role]} · ${row.label}`} checked={(draft.roles[role][kind] as string[]).includes(row.key)} disabled={saving} checkedChildren="Bật" unCheckedChildren="Tắt" onChange={value => toggle(role, kind, row.key as Page | Permission, value)} />;
  } }))];
  async function save() {
    if (!reason.trim()) { message.warning('Vui lòng nhập lý do thay đổi quyền.'); return; }
    setSaving(true);
    try { await dispatch({ type: 'access.save', value: draft, reason: reason.trim() }); message.success('Đã lưu ma trận quyền.'); setOpen(false); setReason(''); setDraft({ ...draft, revision: draft.revision + 1 }); }
    catch (e) { message.error((e as Error).message); } finally { setSaving(false); }
  }
  return <>
    <Alert className="section-note" type="info" showIcon title="Admin được chỉnh toàn bộ ma trận quyền" description="Admin có thể bật/tắt mọi trang và thao tác cho cả bốn vai trò, kể cả Quản trị viên và Tổng quan. Tắt trang sẽ tắt các thao tác liên quan. Kiểm tra kỹ cấu hình trước khi lưu vì thay đổi có thể thu hồi quyền truy cập của chính bạn." />
    <Card className="section-note"><Space wrap><Tag color={dirty ? 'orange' : 'green'}>{dirty ? `${changes.length} thay đổi chưa lưu` : `Đã lưu · phiên bản ${saved.revision}`}</Tag><Button type="primary" disabled={!dirty || saving} onClick={() => setOpen(true)}>Lưu ma trận quyền</Button><Button disabled={!dirty || saving} onClick={() => { setDraft(structuredClone(saved)); setReason(''); }}>Hủy thay đổi</Button><Button disabled={saving} onClick={() => modal.confirm({ title: 'Khôi phục quyền mặc định?', content: 'Cấu hình mặc định sẽ được điền vào bảng để bạn kiểm tra trước khi lưu.', okText: 'Khôi phục', cancelText: 'Hủy', onOk: () => setDraft({ ...defaultAccess(), revision: saved.revision }) })}>Khôi phục mặc định</Button></Space></Card>
    <Card title="Quyền truy cập các trang"><p className="muted">Cuộn ngang bảng để xem và chỉnh sửa đủ bốn vai trò. Mọi ô đều có thể bật/tắt.</p><Table rowKey="key" pagination={false} scroll={{ x: 1000 }} dataSource={pages} columns={columns('pages')} /></Card>
    <Card title="Quyền thực hiện thao tác" className="section-gap"><Table rowKey="key" pagination={false} scroll={{ x: 1000 }} dataSource={Object.entries(permissionNames).map(([key, label]) => ({ key, label }))} columns={columns('permissions')} /></Card>
    <Modal title="Xác nhận thay đổi ma trận quyền" open={open} onCancel={() => !saving && setOpen(false)} onOk={save} okText="Xác nhận lưu" cancelText="Quay lại" confirmLoading={saving} closable={!saving} maskClosable={!saving}>
      <p>Thay đổi áp dụng cho tất cả tài khoản thuộc vai trò, được kiểm tra tại máy chủ và ghi vào nhật ký.</p>
      <ul style={{ maxHeight: 240, overflow: 'auto' }}>{changes.map(item => <li key={item}>{item}</li>)}</ul>
      <label htmlFor="access-reason">Lý do thay đổi quyền</label><Input.TextArea id="access-reason" value={reason} onChange={e => setReason(e.target.value)} maxLength={500} showCount rows={3} disabled={saving} />
    </Modal>
  </>;
}
