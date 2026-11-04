import type { Page, Role } from './domain';

export const actionNames: Record<string, string> = { 'access.save': 'Cập nhật ma trận quyền', 'plan.save': 'Lưu nội dung kế hoạch', 'plan.submit': 'Trình kế hoạch', 'plan.review': 'Xử lý phê duyệt kế hoạch', 'task.create': 'Giao nhiệm vụ', 'task.update': 'Cập nhật tiến độ / gửi nghiệm thu', 'task.review': 'Xử lý nghiệm thu', 'indicator.create': 'Giao chỉ tiêu', 'indicator.update': 'Cập nhật kết quả thực hiện', 'indicator.submit': 'Trình kết quả', 'indicator.review': 'Duyệt / trả lại kết quả', 'strategy.save': 'Lưu mục tiêu chiến lược', 'user.save': 'Cập nhật tài khoản và quyền truy cập', 'unit.save': 'Cập nhật danh mục đơn vị', 'year.save': 'Cập nhật danh mục năm học' };
export const priorityNames = { normal: 'Thông thường', high: 'Ưu tiên cao', urgent: 'Khẩn cấp' };
export function pageDescription(page: Page, role: Role) {
  const descriptions: Record<Page, string> = {
    dashboard: role === 'ADMIN' ? 'Theo dõi tài khoản, đơn vị và lịch sử vận hành để duy trì quyền truy cập đúng phạm vi.' : role === 'BGH' ? 'Theo dõi tình hình thực hiện kế hoạch, hồ sơ chờ phê duyệt và nhiệm vụ cần chỉ đạo trên toàn trường.' : role === 'TDV' ? 'Điều phối kế hoạch, phân công công việc và xác nhận kết quả thực hiện trong đơn vị.' : 'Theo dõi công việc được giao, cập nhật tiến độ và chuẩn bị minh chứng để gửi nghiệm thu.',
    strategy: 'Xác định định hướng, kết quả kỳ vọng và đơn vị chủ trì; theo dõi các kế hoạch triển khai gắn với từng mục tiêu.',
    plans: role === 'BGH' ? 'Xem căn cứ, mục tiêu, sản phẩm và thời gian thực hiện trước khi phê duyệt kế hoạch của các đơn vị.' : 'Lập hồ sơ kế hoạch năm học, liên kết mục tiêu chiến lược và trình Ban Giám hiệu xem xét.',
    tasks: role === 'GV' ? 'Xem yêu cầu công việc, sản phẩm cần bàn giao và thời hạn; cập nhật kết quả, minh chứng và gửi nghiệm thu.' : 'Theo dõi nội dung phân công, người thực hiện, tiến độ và hồ sơ nghiệm thu theo kế hoạch được duyệt.',
    performance: 'Theo dõi kỳ thực hiện, mục tiêu được giao, cách xác định kết quả và minh chứng trước khi trình duyệt, công bố.',
    alerts: 'Rà soát nhiệm vụ quá hạn, sắp đến hạn và hồ sơ cần bổ sung để ưu tiên xử lý kịp thời.',
    reports: 'Tổng hợp tình hình kế hoạch và nhiệm vụ theo năm học, đơn vị; đối chiếu danh sách chi tiết và xuất dữ liệu đang lọc.',
    accounts: 'Cấp tài khoản theo vị trí công việc, gán vai trò và đơn vị; kiểm soát trạng thái hoạt động và cấp lại mật khẩu.',
    units: 'Duy trì danh mục tổ chức dùng cho phân công nhiệm vụ, giới hạn phạm vi truy cập và tổng hợp báo cáo.',
    years: 'Quản lý năm học dùng để phân loại kế hoạch, tra cứu hồ sơ và so sánh kết quả theo thời gian.',
    roles: 'Đối chiếu phạm vi truy cập và thẩm quyền xử lý trước khi gán vai trò cho tài khoản trong đơn vị.',
    logs: 'Tra cứu người thực hiện, thời điểm, hồ sơ liên quan và nội dung xử lý đã ghi nhận trên hệ thống.',
  };
  return descriptions[page];
}
