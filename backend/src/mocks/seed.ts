import type { Store } from '../shared/domain';
import { enrichInitialContent } from './content.ts';

export function createSeed(): Store {
  return enrichInitialContent({
    version: 1,
    units: [{ id: 'cntt', name: 'Khoa Công nghệ thông tin' }, { id: 'kt', name: 'Khoa Kinh tế' }, { id: 'bgh', name: 'Ban Giám hiệu' }, { id: 'it', name: 'Phòng Quản trị hệ thống' }],
    years: [{ id: '2026', name: '2026 – 2027' }, { id: '2025', name: '2025 – 2026' }],
    users: [
      { id: 'bgh', name: 'Nguyễn Minh Anh', email: 'bgh@quantrikpi.local', role: 'BGH', unitId: 'bgh', active: true },
      { id: 'tdv', name: 'Trần Quốc Huy', email: 'tdv@quantrikpi.local', role: 'TDV', unitId: 'cntt', active: true },
      { id: 'gv', name: 'Lê Thu Hà', email: 'giangvien@quantrikpi.local', role: 'GV', unitId: 'cntt', active: true },
      { id: 'admin', name: 'Phạm Đức Nam', email: 'admin@quantrikpi.local', role: 'ADMIN', unitId: 'it', active: true },
      { id: 'gv2', name: 'Nguyễn Hoàng Long', email: 'long@quantrikpi.local', role: 'GV', unitId: 'cntt', active: true },
      { id: 'tdv2', name: 'Đỗ Thanh Tùng', email: 'tdv.kt@quantrikpi.local', role: 'TDV', unitId: 'kt', active: true },
      { id: 'gv3', name: 'Vũ Ngọc Mai', email: 'mai@quantrikpi.local', role: 'GV', unitId: 'kt', active: true },
    ],
    strategies: [
      { id: 's1', title: 'Nâng cao chất lượng đào tạo', description: 'Đổi mới chương trình, tăng cường học liệu số và hoạt động đảm bảo chất lượng.' },
      { id: 's2', title: 'Thúc đẩy nghiên cứu khoa học', description: 'Phát triển nhóm nghiên cứu và nâng cao chất lượng công bố của giảng viên.' },
      { id: 's3', title: 'Chuyển đổi số trong quản trị', description: 'Chuẩn hóa quy trình điều hành và theo dõi hiệu quả thực hiện nhiệm vụ.' },
    ],
    plans: [
      { id: 'p1', title: 'Đổi mới học liệu và chương trình đào tạo', unitId: 'cntt', yearId: '2026', status: 'approved' },
      { id: 'p2', title: 'Phát triển hoạt động nghiên cứu khoa học', unitId: 'cntt', yearId: '2026', status: 'submitted' },
      { id: 'p3', title: 'Hợp tác doanh nghiệp và thực tập', unitId: 'kt', yearId: '2026', status: 'approved' },
      { id: 'p4', title: 'Bồi dưỡng chuyên môn cho giảng viên', unitId: 'cntt', yearId: '2026', status: 'draft' },
    ],
    tasks: [
      { id: 't1', title: 'Xây dựng học liệu số môn Cơ sở dữ liệu', planId: 'p1', assigneeId: 'gv', due: '2026-11-20', progress: 65, evidence: 'Đã hoàn thành nội dung chương 1–3.', status: 'working' },
      { id: 't2', title: 'Rà soát đề cương học phần', planId: 'p1', assigneeId: 'gv', due: '2026-11-10', progress: 100, evidence: 'Biên bản rà soát đề cương số 12/2026.', status: 'review' },
      { id: 't3', title: 'Hoàn thiện ngân hàng câu hỏi', planId: 'p1', assigneeId: 'gv2', due: '2026-10-30', progress: 40, evidence: '', status: 'working' },
      { id: 't4', title: 'Báo cáo kết quả khảo sát doanh nghiệp', planId: 'p3', assigneeId: 'gv3', due: '2026-11-25', progress: 30, evidence: '', status: 'working' },
      { id: 't5', title: 'Tổng hợp phản hồi người học', planId: 'p1', assigneeId: 'gv', due: '2026-10-28', progress: 100, evidence: 'Báo cáo tổng hợp đã được xác nhận.', status: 'accepted' },
    ],
    indicators: [
      { id: 'i1', title: 'Học phần có học liệu số', userId: 'gv', target: 4, actual: 2, unit: 'học phần', status: 'draft' },
      { id: 'i2', title: 'Bài báo khoa học được công bố', userId: 'gv', target: 2, actual: 2, unit: 'bài', status: 'published' },
      { id: 'i3', title: 'Chuyên đề sinh hoạt học thuật', userId: 'gv2', target: 3, actual: 3, unit: 'chuyên đề', status: 'submitted' },
      { id: 'i4', title: 'Doanh nghiệp hợp tác', userId: 'gv3', target: 5, actual: 2, unit: 'doanh nghiệp', status: 'draft' },
    ],
    logs: [],
  });
}
