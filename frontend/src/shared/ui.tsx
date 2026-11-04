import { Tag, Space, Progress } from 'antd';

export const statuses: Record<string, { label: string; color: string }> = {
  draft: { label: 'Bản nháp', color: 'default' }, submitted: { label: 'Chờ phê duyệt', color: 'gold' },
  approved: { label: 'Đã duyệt', color: 'green' }, returned: { label: 'Cần chỉnh sửa', color: 'orange' },
  assigned: { label: 'Được giao', color: 'blue' }, working: { label: 'Đang thực hiện', color: 'processing' },
  review: { label: 'Chờ nghiệm thu', color: 'gold' }, accepted: { label: 'Đã nghiệm thu', color: 'green' },
  revision: { label: 'Cần bổ sung', color: 'orange' }, published: { label: 'Đã công bố', color: 'green' },
};
export function Status({ value }: { value: string }) { const s = statuses[value]; return <Tag color={s?.color}>{s?.label ?? value}</Tag>; }
export function TitleCell({ title, subtitle }: { title: string; subtitle?: string }) { return <div className="title-cell"><strong>{title}</strong>{subtitle && <small>{subtitle}</small>}</div>; }
export function Percent({ value }: { value: number }) { return <Progress percent={Math.round(value)} size="small" strokeColor="#1677c8" />; }
export function Actions({ children }: { children: React.ReactNode }) { return <Space size={[6, 8]} wrap>{children}</Space>; }
export function formatDate(value: string) { return new Date(value.length === 10 ? `${value}T00:00:00` : value).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
export const required = [{ required: true, message: 'Vui lòng nhập thông tin này.' }];
