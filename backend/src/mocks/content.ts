import type { Store, Plan, Task, Indicator, Strategy } from '../shared/domain';

// Supplement only unchanged initial records and only previously absent fields.
// User-entered content, renamed records, passwords and identifiers are preserved.
export function enrichInitialContent(input: Store): Store {
  const store = structuredClone(input);
  function merge<T extends { id: string; title: string }>(records: T[], defaults: Record<string, Partial<T>>) {
    for (const row of records) {
      const initial = defaults[row.id];
      if (!initial || row.title !== initial.title) continue;
      for (const [key, value] of Object.entries(initial)) if (!(key in row)) Object.assign(row, { [key]: value });
    }
  }
  merge<Plan>(store.plans, {
    p1: { title: 'Đổi mới học liệu và chương trình đào tạo', strategyId: 's1', objective: 'Rà soát nội dung các học phần chuyên ngành, bổ sung học liệu số và thống nhất yêu cầu đánh giá kết quả học tập theo đề cương.', deliverables: 'Bộ đề cương học phần đã rà soát; học liệu điện tử có cấu trúc theo chương; ngân hàng câu hỏi kèm đáp án; báo cáo tổng hợp phản hồi người học.', startDate: '2026-09-01', endDate: '2027-07-31', reference: 'Kế hoạch công tác năm học của đơn vị và kết quả rà soát chương trình đào tạo.' },
    p2: { title: 'Phát triển hoạt động nghiên cứu khoa học', strategyId: 's2', objective: 'Tổ chức hoạt động nghiên cứu theo nhóm chuyên môn, hỗ trợ giảng viên hoàn thiện đề xuất nghiên cứu và chia sẻ kết quả học thuật.', deliverables: 'Danh sách hướng nghiên cứu; đề xuất nhiệm vụ khoa học; biên bản sinh hoạt chuyên môn; danh mục công bố và minh chứng được đơn vị xác nhận.', startDate: '2026-09-01', endDate: '2027-07-31', reference: 'Định hướng hoạt động khoa học của đơn vị và đăng ký nhiệm vụ của giảng viên.' },
    p3: { title: 'Hợp tác doanh nghiệp và thực tập', strategyId: 's1', objective: 'Khảo sát nhu cầu nhân lực, cập nhật yêu cầu thực tập và tăng cường phối hợp với đơn vị sử dụng lao động.', deliverables: 'Báo cáo khảo sát doanh nghiệp; danh sách đối tác; đề xuất nội dung phối hợp thực tập và hỗ trợ sinh viên.', startDate: '2026-09-01', endDate: '2027-07-31', reference: 'Kế hoạch đào tạo và chương trình phối hợp doanh nghiệp của đơn vị.' },
    p4: { title: 'Bồi dưỡng chuyên môn cho giảng viên', strategyId: 's1', objective: 'Xác định nhu cầu bồi dưỡng theo vị trí công việc và tổ chức trao đổi phương pháp giảng dạy, đánh giá người học.', deliverables: 'Danh sách nhu cầu bồi dưỡng; nội dung chuyên đề; danh sách tham dự; báo cáo kết quả và đề xuất áp dụng.', startDate: '2026-11-01', endDate: '2027-06-30', reference: 'Đăng ký bồi dưỡng chuyên môn và kế hoạch phát triển đội ngũ của đơn vị.' },
  });
  merge<Task>(store.tasks, {
    t1: { title: 'Xây dựng học liệu số môn Cơ sở dữ liệu', description: 'Biên soạn bài giảng theo chương, chuẩn hóa ví dụ thực hành và xây dựng câu hỏi tự kiểm tra. Rà soát tính thống nhất với đề cương học phần trước khi gửi nghiệm thu.', expectedOutput: 'Bộ bài giảng điện tử, bài tập thực hành và danh mục tài liệu tham khảo. Nội dung có mục tiêu học tập, hướng dẫn sử dụng và đáp án cho phần tự kiểm tra.', priority: 'high', startDate: '2026-10-01' },
    t2: { title: 'Rà soát đề cương học phần', description: 'Đối chiếu mục tiêu, chuẩn đầu ra, nội dung, thời lượng và phương pháp đánh giá; tổng hợp ý kiến của bộ môn vào biên bản rà soát.', expectedOutput: 'Đề cương đã chỉnh sửa và bảng đối chiếu nội dung thay đổi có xác nhận của bộ môn.', priority: 'normal', startDate: '2026-10-05' },
    t3: { title: 'Hoàn thiện ngân hàng câu hỏi', description: 'Phân loại câu hỏi theo nội dung và mức độ đánh giá; kiểm tra độ rõ ràng, đáp án và khả năng sử dụng trong kiểm tra kết thúc học phần.', expectedOutput: 'Ngân hàng câu hỏi theo ma trận nội dung, kèm đáp án và hướng dẫn chấm.', priority: 'high', startDate: '2026-10-01' },
    t4: { title: 'Báo cáo kết quả khảo sát doanh nghiệp', description: 'Tổng hợp phiếu khảo sát và ý kiến đối tác về yêu cầu kỹ năng nghề nghiệp; chỉ ra nội dung cần cập nhật trong hoạt động đào tạo, thực tập.', expectedOutput: 'Báo cáo có bảng tổng hợp kết quả khảo sát, phân tích nhu cầu và đề xuất phối hợp với doanh nghiệp.', priority: 'normal', startDate: '2026-10-15' },
    t5: { title: 'Tổng hợp phản hồi người học', description: 'Thu thập, phân nhóm ý kiến theo học phần và nội dung đào tạo; tổng hợp các đề xuất cải tiến để đơn vị xem xét.', expectedOutput: 'Báo cáo tổng hợp phản hồi và danh sách kiến nghị cải tiến theo nhóm nội dung.', priority: 'normal', startDate: '2026-10-01' },
  });
  merge<Indicator>(store.indicators, {
    i1: { title: 'Học phần có học liệu số', period: 'Năm học 2026 – 2027', measurement: 'Đếm số học phần có bộ học liệu số hoàn chỉnh được đơn vị xác nhận. Một học phần chỉ tính một lần trong kỳ.', evidence: 'Danh mục học liệu và biên bản xác nhận của bộ môn.' },
    i2: { title: 'Bài báo khoa học được công bố', period: 'Năm học 2026 – 2027', measurement: 'Đếm công bố đã xuất bản có thông tin tác giả và đơn vị công tác. Hồ sơ đối chiếu gồm tên bài, nơi công bố và thời điểm xuất bản.', evidence: 'Danh mục hai công bố đã được duyệt trong kỳ; tham chiếu hồ sơ của đơn vị.' },
    i3: { title: 'Chuyên đề sinh hoạt học thuật', period: 'Học kỳ I · 2026 – 2027', measurement: 'Đếm chuyên đề đã tổ chức, có nội dung trình bày, danh sách tham dự và biên bản sinh hoạt được đơn vị xác nhận.', evidence: 'Nội dung và biên bản của ba buổi sinh hoạt học thuật.' },
    i4: { title: 'Doanh nghiệp hợp tác', period: 'Năm học 2026 – 2027', measurement: 'Đếm doanh nghiệp có hoạt động phối hợp đã thực hiện trong kỳ, kèm tài liệu xác nhận; không cộng trùng theo từng hoạt động.', evidence: 'Danh mục hoạt động phối hợp và tài liệu xác nhận của đối tác.' },
  });
  merge<Strategy>(store.strategies, {
    s1: { title: 'Nâng cao chất lượng đào tạo', period: 'Năm học 2026 – 2027', ownerUnitId: 'bgh', expectedOutcome: 'Chương trình, đề cương và học liệu được rà soát đồng bộ; các đề xuất cải tiến có đơn vị phụ trách và kế hoạch thực hiện.' },
    s2: { title: 'Thúc đẩy nghiên cứu khoa học', period: 'Năm học 2026 – 2027', ownerUnitId: 'bgh', expectedOutcome: 'Các đơn vị tổ chức hoạt động học thuật theo kế hoạch, theo dõi đề xuất nghiên cứu và kết quả công bố bằng hồ sơ đối chiếu.' },
    s3: { title: 'Chuyển đổi số trong quản trị', period: 'Năm học 2026 – 2027', ownerUnitId: 'it', expectedOutcome: 'Kế hoạch và nhiệm vụ được theo dõi thống nhất; kết quả cập nhật có minh chứng tham chiếu và lịch sử xử lý theo thẩm quyền.' },
  });
  return store;
}
