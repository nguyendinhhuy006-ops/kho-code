# Giao KPI và OKR

## Các dự án đã đối chiếu trên GitHub

- [Ever Gauzy — Goals and KPIs](https://github.com/ever-co/ever-gauzy-docs/blob/develop/website/docs/features/goals-and-kpis.md): phân cấp mục tiêu, người phụ trách, chỉ số định lượng, kỳ và hạn hoàn thành.
- [Stytch OKR Manager — OKREditor.tsx](https://github.com/stytchauth/mcp-stytch-b2b-okr-manager/blob/main/src/OKREditor.tsx): tách Objective và danh sách Key Result; kiểm tra quyền ở từng thao tác.
- [OKR Strapi](https://github.com/appregidc/okr-strapi): mục tiêu có nhiều kết quả định lượng, gắn đơn vị và ngày hoàn thành.

Đã đọc tài liệu và mã thành phần của các dự án trên trước khi triển khai. Áp dụng mô hình nghiệp vụ vào React/Ant Design/Node/SQL Server hiện có; không sao chép mã hay thay nền tảng ứng dụng.

## Cách dùng

Trưởng đơn vị vào Chỉ tiêu KPI/OKR → Giao chỉ tiêu:

1. **KPI**: giao một chỉ tiêu riêng lẻ, người nhận, kỳ, mức cần đạt, đơn vị, hạn (tùy chọn), cách đo và minh chứng.
2. **OKR**: nhập mục tiêu chung và kỳ/hạn bắt buộc; thêm 1–5 kết quả then chốt (gợi ý 2–3). Mỗi kết quả có tên, người phụ trách trong phạm vi quyền, mức cần đạt, đơn vị và yêu cầu minh chứng. Mẫu học liệu số minh họa cách điền.
3. Bấm Giao chỉ tiêu để lưu toàn bộ OKR trong một giao dịch. Nếu một kết quả sai hoặc người nhận ngoài phạm vi thì không lưu bất kỳ kết quả nào trong yêu cầu.
4. Người nhận cập nhật từng kết quả và gửi tệp/ảnh minh chứng. Trưởng đơn vị trình duyệt; Ban Giám hiệu duyệt/công bố như quy trình hiện có. Chỉ người có quyền mới được cập nhật hoặc xem hồ sơ.

Các số đo hiện hỗ trợ mục tiêu tích lũy từ 0, lớn hơn 0; tỷ lệ mỗi kết quả = thực hiện/mục tiêu. Chưa áp dụng chiều giảm, giá trị ban đầu khác 0, trọng số, chấm điểm tổng hợp hay tự động công bố một OKR. Không diễn giải tỷ lệ đạt thành xếp loại nhân sự.

## Lưu dữ liệu

`dbo.KPI` bổ sung bốn cột nullable: `LoaiChiTieu`, `MucTieuOKR`, `MaMucTieuOKR`, `HanHoanThanh`. Dữ liệu cũ không có loại được hiển thị là KPI. Mỗi KR là một dòng KPI, cùng OKR chia sẻ mã mục tiêu UUID do server tạo; thông tin mục tiêu/kỳ/hạn được gán chung khi giao. Mỗi KR giữ nguyên lịch sử, tệp đính kèm và quy trình duyệt riêng. `initializeIndicatorSchema` thêm cột idempotent trước khi API đọc dữ liệu; schema kiểm thử quan hệ mới tạo cùng cấu trúc.

API giao OKR: `POST /api/commands` với `type: indicator.assign`, `objective`, `period`, `due`, `results`. Backend tự kiểm tra quyền và toàn bộ kết quả; không tin phạm vi hoặc mã nhóm do client gửi. Giao KPI cũ vẫn dùng `indicator.create`.
