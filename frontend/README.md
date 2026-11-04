# QuanTriKPI — Quản trị điều hành Đại học Hải Phòng

## Chạy ứng dụng

Yêu cầu Node.js 24+ (đã kiểm tra với 24.11.0). Tại thư mục frontend:

```powershell
npm install --cache .npm-cache
npm run db:check
npm run setup
npm run dev
```

Chạy `npm run db:check` để kiểm tra dịch vụ SQL Server đang hoạt động rồi `npm run dev`. Với dữ liệu PostgreSQL cũ, dừng API cũ và chạy `npm run db:migrate` trước setup/dev. Xem [hướng dẫn SQL Server](server/SQLSERVER.md). Lệnh dev mở cả API và giao diện; nếu máy chủ cũ còn chạy, dừng terminal cũ bằng Ctrl+C rồi chạy lại.

Mở địa chỉ Local mà Vite in ra, thường là http://127.0.0.1:5173. Nếu cổng đang được dùng, Vite chọn cổng kế tiếp. API mặc định tại 127.0.0.1:3001 và được proxy qua cùng địa chỉ giao diện.

## Tài khoản đăng nhập

Mở tệp `.data/tai-khoan-ban-dau.txt` trên máy để xem email và mật khẩu của các tài khoản đã được cấp. Mỗi tài khoản được tạo mật khẩu ngẫu nhiên riêng. Tệp này không được đưa vào Git hoặc phục vụ qua HTTP; không chia sẻ công khai.

Các địa chỉ `@quantrikpi.local` là tên tài khoản nội bộ, không phải hộp thư của trường. Bốn tài khoản chính là bgh, tdv, giangvien và admin tại tên miền nội bộ trên. Không còn danh sách tự chọn vai trò trên trang đăng nhập.

- Đăng nhập bằng email/mật khẩu; quyền được lấy từ tài khoản trên máy chủ.
- Dùng Đổi mật khẩu trong menu để cập nhật mật khẩu; mật khẩu mới từ 12 đến 128 ký tự.
- Quản trị viên cấp tài khoản mới hoặc cấp lại mật khẩu tại Quản lý tài khoản. Mật khẩu khởi tạo là trường bắt buộc cho tài khoản mới; khi sửa, để trống để giữ mật khẩu cũ.
- Đăng xuất thu hồi phiên trên máy chủ. Đổi mật khẩu/cấp lại mật khẩu kết thúc các phiên khác; khóa tài khoản chặn truy cập tiếp theo.
- Không có chức năng gửi email khôi phục mật khẩu. Người dùng liên hệ quản trị viên để được cấp lại.

## Những thay đổi mới

Logo chính thức được trích xuất nguyên ảnh từ logo.docx người dùng cung cấp, dùng ở trang đăng nhập, menu desktop/mobile và favicon. Không sửa logo hoặc nội dung tệp Word.

Đã bỏ các nhãn demo/thử nghiệm, danh sách chọn tài khoản và các đoạn mô tả mô phỏng khỏi giao diện. Trang đăng nhập có email, mật khẩu, ẩn/hiện mật khẩu, kiểm tra trường, trạng thái đang xử lý và thông báo lỗi.

Máy chủ Node và SQL Server: xác thực email/mật khẩu, phiên cookie HttpOnly/SameSite, băm mật khẩu bằng scrypt với salt riêng, hạn phiên 8 giờ, giới hạn nhập sai và kiểm tra nguồn yêu cầu. Thông tin phiên và mật khẩu không lưu vào localStorage/sessionStorage. Tất cả thao tác nghiệp vụ gửi tới API; máy chủ kiểm tra vai trò, phạm vi dữ liệu và trạng thái trước khi lưu.

Dữ liệu nghiệp vụ hiện khởi tạo từ bộ dữ liệu mẫu hai khoa. Chưa thay bằng dữ liệu thực của trường hoặc tích hợp SSO. Việc bỏ nhãn trên giao diện không có nghĩa tất cả nghiệp vụ đã hoàn tất.

## Phân quyền và nghiệp vụ

| Vai trò | Phạm vi | Thao tác chính |
|---|---|---|
| Ban Giám hiệu | Toàn trường | Chiến lược, duyệt/trả kế hoạch, giao chỉ tiêu, duyệt/công bố kết quả đầu vào; xem nhiệm vụ và báo cáo |
| Trưởng đơn vị | Đơn vị được gán | Lập/trình kế hoạch, giao việc từ kế hoạch đã duyệt, nghiệm thu, giao/cập nhật/trình chỉ tiêu, báo cáo đơn vị |
| Cán bộ/Giảng viên | Nhiệm vụ/chỉ tiêu được giao | Cập nhật tiến độ, minh chứng văn bản, gửi nghiệm thu, cập nhật kết quả chưa trình |
| Quản trị viên | Tài khoản và danh mục | Cấp/sửa/khóa tài khoản, cấp lại mật khẩu, gán vai trò/đơn vị; danh mục đơn vị/năm học, ma trận quyền và lịch sử |

Luồng chính: Trưởng đơn vị lập và trình kế hoạch → BGH duyệt → Trưởng đơn vị giao việc → Giảng viên cập nhật đạt 100% kèm tham chiếu minh chứng rồi gửi nghiệm thu → Trưởng đơn vị nghiệm thu hoặc yêu cầu bổ sung. Chuyển tài khoản bằng đăng xuất và đăng nhập lại.

Quản trị không mặc nhiên có quyền duyệt nghiệp vụ. API chỉ trả dữ liệu trong phạm vi tài khoản; thay localStorage, gửi actorId hoặc tự khai vai trò không cấp thêm quyền.

## Lưu trữ và triển khai

- Cơ sở dữ liệu: SQL Server, kết nối qua `SQLSERVER_CONNECTION_STRING` trong `.env.sqlserver.local`. Bản local ở `.\SQLEXPRESS`, database `QuanTriKPI`, schema `quantrikpi_app`. Dữ liệu nghiệp vụ lưu JSON (NVARCHAR(MAX), CHECK ISJSON). Xem [cấu hình và migration](server/SQLSERVER.md).
- Không xóa hoặc ghi đè localStorage của bản trước. Công cụ hiện tại chuyển PostgreSQL sang SQL Server; bộ chuyển SQLite sang PostgreSQL cũ được giữ lại. Dữ liệu chỉ lưu trong trình duyệt cũ chưa được nhập tự động.
- PostgreSQL và SQLite cũ được giữ nguyên. Công cụ migration tạo bản sao nhất quán trong `.data/backups/`. Sao lưu SQL Server bằng chức năng Backup trong SQL Server Management Studio, không sao chép MDF/LDF đang hoạt động.
- API chỉ lắng nghe loopback. Chưa triển khai lên Internet. Khi triển khai thật cần HTTPS, reverse proxy, cấu hình COOKIE_SECURE=true, vận hành cơ sở dữ liệu/sao lưu và rà soát bảo mật phù hợp môi trường.
- Nhật ký nghiệp vụ lưu trên máy chủ nhưng chưa phải kho kiểm toán chống sửa đổi. Chưa ghi đầy đủ sự kiện xác thực vào hệ thống giám sát.
- Mẫu dữ liệu ban đầu, minh chứng văn bản, chỉ tiêu đầu vào và CSV vẫn như phạm vi đã triển khai; chưa có upload tệp, AI, PDF/Excel hoặc công thức KPI/OKR đầy đủ.
- SQLite tích hợp Node 24 chỉ còn dùng cho migration và bài kiểm thử migration.

Biến môi trường: SQLSERVER_CONNECTION_STRING bắt buộc; SQLSERVER_SCHEMA, API_PORT, API_DATA_DIR và COOKIE_SECURE tùy chọn. NODE_ENV=test chỉ dành cho schema test_/e2e_ biệt lập; không đặt chế độ này cho ứng dụng sử dụng thật.

Kiểm tra bản build: chạy `npm run build`; sau đó mở một terminal `npm run api`, terminal khác `npm run preview` để xem bản build có API. Không mở index.html bằng file://.

## Kiểm tra

```powershell
npm test
npm run test:migration
npm run test:api
npm run build
npm run test:e2e
```

E2E dùng Chrome, cổng giao diện riêng 5183, API 3002 và schema SQL Server riêng `e2e_...`; dữ liệu phụ trong `.data/e2e-...`. Dữ liệu kiểm thử được đặt lại trước mỗi bài và không tác động schema sử dụng. Tệp/ảnh kết quả giữ trong artifacts/. Tài khoản kiểm thử cố định chỉ hoạt động trong môi trường kiểm thử.

Bản build hiện có cảnh báo bundle JavaScript lớn; chưa tối ưu chia tải theo phân hệ. Không coi kiểm thử hiện tại là kiểm toán bảo mật độc lập hoặc nghiệm thu toàn bộ sản phẩm.

## Mã nguồn và tài liệu đối chiếu

- src/app: giao diện đăng nhập, phiên, gọi API, route và khung ứng dụng.
- src/features/Workspace.tsx: các phân hệ nghiệp vụ.
- src/shared/domain.ts: quyền, phạm vi và quy tắc; API dùng cùng bộ quy tắc này.
- server/index.ts: xác thực, phiên và API; server/database-sqlserver.ts: pool kết nối, transaction và lưu SQL Server.
- scripts/dev.mjs: chạy API cùng Vite; Ctrl+C kết thúc hai tiến trình.
- public/branding/image1.png: logo gốc trích xuất từ Word.

Đã đối chiếu [express-session](https://github.com/expressjs/session) về mô hình phiên cookie/máy chủ, [Node crypto](https://nodejs.org/api/crypto.html) về scrypt và so sánh hash, [Vite server options](https://vite.dev/config/server-options.html) về proxy và chặn tệp riêng. Không sao chép mã từ các nguồn này. Các lượt trước tham khảo Ant Design Pro và Refine cho cấu trúc ứng dụng quản trị.

Kết quả xác minh cập nhật 03/11/2026: 16/16 kiểm thử quy tắc đạt; 18/18 kiểm thử trình duyệt/API đạt trong một lượt chạy đầy đủ; kiểm tra kiểu dữ liệu frontend/backend và bản build production thành công. Đã xem ảnh đăng nhập desktop/mobile và dashboard có logo mới tại artifacts/. Máy chủ E2E dùng cổng riêng và đã kết thúc sau kiểm tra.

## Nội dung nghiệp vụ chi tiết — cập nhật 03/11/2026

Các trang đã bổ sung nội dung theo hồ sơ thực hiện: mục tiêu/căn cứ/sản phẩm/thời gian của kế hoạch; mô tả/tiêu chí bàn giao/ưu tiên của nhiệm vụ; kỳ/cách xác định/minh chứng của chỉ tiêu; chủ trì/giai đoạn/kết quả kỳ vọng của chiến lược. Nút Xem chi tiết mở hồ sơ và lịch sử xử lý được lọc đúng quyền. Dashboard có hàng việc theo thẩm quyền; cảnh báo chia bốn nhóm; báo cáo lọc năm học/đơn vị và xuất đúng danh sách đang xem.

Quy tắc mới: trình kế hoạch cần đủ mục tiêu, sản phẩm và ngày hợp lệ; giao nhiệm vụ cần yêu cầu đầu ra, không vượt thời gian kế hoạch; trình kết quả chỉ tiêu cần minh chứng. Hồ sơ cũ thiếu trường có thể cần chỉnh sửa trước khi trình.

Máy chủ khi khởi động bổ sung các trường còn thiếu cho dữ liệu khởi tạo chưa bị đổi tên, giữ nội dung đã chỉnh sửa và toàn bộ tài khoản/mật khẩu. `npm run setup` cũng thực hiện bổ sung này. Dữ liệu nghiệp vụ vẫn là mẫu; không thay thế hồ sơ thực của trường. Đặc tả nội dung có trong ../noi-dung-front-end.md.

Kết quả xác minh nội dung chi tiết: 23/23 kiểm thử quy tắc đạt, kiểm tra kiểu và bản build frontend/backend thành công. Bộ trình duyệt/API hiện có 24 tình huống đã đạt qua lượt hồi quy và các lượt chạy lại có mục tiêu: lượt đầy đủ đạt 21/23, hai tình huống còn lại đạt sau khi chuẩn hóa ngày và chờ phản hồi API; tình huống bổ sung về nhóm cảnh báo/mobile đạt sau sửa bộ chọn nhãn trong bài kiểm thử. Đã xem ảnh biểu mẫu kế hoạch, hồ sơ có lịch sử phê duyệt, báo cáo và hồ sơ mobile. Còn cảnh báo bundle lớn như các lượt trước; không phải kiểm toán bảo mật độc lập.
