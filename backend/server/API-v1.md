# API v1 — bước triển khai đầu tiên

Ngày 04/11/2026. Đã có API kế hoạch trên Node/SQLite; chưa chuyển PostgreSQL hoặc dùng NestJS/Prisma. Frontend tiếp tục dùng API cũ trong thời gian chuyển đổi.

## Phiên và lỗi

Đăng nhập qua `POST /api/auth/login` như hiện tại; các endpoint mới dùng cùng cookie HttpOnly. `GET /api/v1/me` trả `{ user }`. Gửi JSON cùng origin khi thay đổi dữ liệu.

Mỗi request có header `X-Request-Id`. Lỗi xử lý trả `{ code, message, requestId }`. 401: hết phiên; 403: thiếu quyền; 404: không tìm thấy trong phạm vi; 409: bản sửa cũ; 422: đầu vào API không hợp lệ; 405: phương thức không hỗ trợ. Các lỗi quy tắc nghiệp vụ từ domain hiện vẫn trả 400 để giữ tương thích.

## Kế hoạch

| Endpoint | Nội dung |
|---|---|
| `GET /api/v1/plans` | `{ items, page, pageSize, total }` |
| `GET /api/v1/plans/:id` | `{ item }` gồm `version` |
| `POST /api/v1/plans` | Tạo nháp bằng `title`, `yearId` và nội dung kế hoạch |
| `PATCH /api/v1/plans/:id` | Sửa từng trường, bắt buộc `version` |
| `POST /api/v1/plans/:id/submit` | Trình với `{ version }` |
| `POST /api/v1/plans/:id/review` | `{ version, approved: boolean, reason?: string }` |

Danh sách nhận `page` (mặc định 1), `pageSize` (20, tối đa 100), `q`, `status`, `unitId`, `yearId`. Bộ lọc chỉ áp dụng sau khi giới hạn phạm vi; không cho người dùng đọc hồ sơ ngoài phạm vi bằng cách sửa ID.

Các trường có thể ghi: `title`, `yearId`, `strategyId`, `objective`, `deliverables`, `startDate`, `endDate`, `reference`. Backend tự gán ID, đơn vị, trạng thái và actor; bỏ qua các trường tự khai quyền hoặc trạng thái. PATCH giữ các trường không được gửi lên. Gửi chuỗi rỗng để xóa nội dung tùy chọn khi quy tắc nghiệp vụ cho phép.

API ghi hiện trả `{ userId, data }` tương thích frontend cũ, status 200. Lấy phiên bản mới từ GET chi tiết trước lần sửa tiếp theo. `version` là token opaque, không tự tính tại client. Khi nhận 409, tải hồ sơ mới và để người dùng đối chiếu thay đổi trước khi gửi lại.

Module `plans.ts` ánh xạ REST sang command; domain vẫn kiểm tra quyền và trạng thái, SQLite vẫn lưu hồ sơ cùng audit trong transaction. API cũ được giữ nguyên. Chỉ API v1 yêu cầu version; client cũ chưa có bảo vệ bản sửa cũ này. Giai đoạn hiện tại dành cho một tiến trình API; chưa tuyên bố an toàn khi nhiều tiến trình cùng ghi SQLite. Token hash phát hiện thay đổi nội dung, chưa thay thế cột revision tăng dần của thiết kế quan hệ sắp tới.

## Kiểm tra

Chạy trong `frontend`: `npm run test:api`, `npm test`, `npm run build`. Kiểm thử API tự mở cổng trống và cơ sở dữ liệu test riêng `.data/api-v1-*`, kết thúc máy chủ sau khi chạy và giữ lại tệp để đối chiếu. Không sử dụng dữ liệu hoặc mật khẩu của người dùng thật.

Đã đối chiếu cấu trúc route tài nguyên từ [Express mã nguồn mở](https://github.com/expressjs/express) trước khi triển khai. Không cài thêm Express hoặc sao chép mã.

## Các bước tiếp theo

1. Schema quan hệ, migration trên bản sao và môi trường PostgreSQL biệt lập.
2. Version tăng dần tại database và idempotency cho các thao tác ghi; kiểm thử nhiều kết nối.
3. Chuyển frontend sang API v1 rồi mở rộng nhiệm vụ/chỉ tiêu, upload, báo cáo và vận hành theo ke-hoach-backend.md.
