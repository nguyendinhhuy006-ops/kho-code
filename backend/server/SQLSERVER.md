# SQL Server của QuanTriKPI

Backend hiện sử dụng Microsoft SQL Server Express 2019 trên máy Windows, instance `.\SQLEXPRESS`, database `QuanTriKPI`, schema `quantrikpi_app`. Driver: `mssql` + `msnodesqlv8`, ODBC Driver 17, Node.js 24+. Xác thực bằng tài khoản Windows chạy Node; không tạo hoặc đổi mật khẩu SQL Server, không bật Mixed Mode/TCP hay khởi động lại dịch vụ SQL Server.

## Chạy ứng dụng

```powershell
cd frontend
npm install --cache .npm-cache
npm run db:check
npm run dev
```

Dịch vụ `MSSQL$SQLEXPRESS` cần ở trạng thái Running. `db:start` hiện chỉ kiểm tra kết nối SQL Server, không khởi động PostgreSQL hoặc thay đổi dịch vụ dùng chung. Giao diện thường tại http://127.0.0.1:5173, API tại 3001. `/api/health` trả `database: "sqlserver"` sau khi lấy được transaction/khóa trong SQL Server.

Cấu hình chính tại `.env.sqlserver.local`, đã loại khỏi Git và bị Vite chặn truy cập. `.env.example` là mẫu. `.env.local` cũ chứa URL PostgreSQL và được giữ cho việc chuyển dữ liệu; backend không dùng `DATABASE_URL` để lưu dữ liệu nữa.

```dotenv
SQLSERVER_CONNECTION_STRING="Driver={ODBC Driver 17 for SQL Server};Server={.\SQLEXPRESS};Database={QuanTriKPI};Trusted_Connection=Yes;Encrypt=No;"
SQLSERVER_SCHEMA=quantrikpi_app
```

`Encrypt=No` chỉ dành cho kết nối cục bộ hiện tại. Với máy chủ khác, cấu hình mã hóa/chứng thư phù hợp và tài khoản chạy ứng dụng có quyền giới hạn trong database/schema cần thiết. Không đưa mật khẩu hoặc chuỗi kết nối có mật khẩu lên Git. Windows Authentication cần phiên Windows có quyền kết nối; chạy trong sandbox không có thông tin đăng nhập Windows có thể thất bại dù chạy terminal bình thường hoạt động.

## Dữ liệu và phạm vi

Sau migration quan hệ ngày 10/11/2026, backend đọc/ghi trực tiếp `dbo.TaiKhoan`, `dbo.DonVi`, `dbo.NamHoc`, `dbo.ChienLuoc`, `dbo.KeHoach`, `dbo.NhiemVu`, `dbo.KPI`, `dbo.NhatKy` và các bảng quyền. Xem [ánh xạ và hướng dẫn SQL](SQL-RELATIONAL.md). Các bảng cũ được giữ nguyên dữ liệu trong schema `quantrikpi_legacy_20261110`.

| Bảng | Nội dung |
|---|---|
| `dbo.*` | Dữ liệu nghiệp vụ và ma trận quyền trong bảng quan hệ |
| `dbo.ThongTinDangNhap` | Mã người dùng, salt và hash mật khẩu scrypt |
| `quantrikpi_app.sessions` | Hash token, người dùng, hạn phiên BIGINT |
| `quantrikpi_app.attempts` | Giới hạn đăng nhập sai và thời hạn |
| `quantrikpi_app.storage_config` | Chỉ định nguồn dữ liệu quan hệ trong schema dbo |

Ảnh chụp JSON và bảng mật khẩu trước chuyển đổi nằm trong schema lưu trữ, không còn được dùng làm nguồn dữ liệu web. Không sao chép mật khẩu rõ từ bảng cũ vào hash.

Các truy vấn có tham số `@arg1`, `@arg2` và tên bảng đủ schema. Mỗi yêu cầu dùng cùng một transaction; `sp_getapplock` với khóa theo schema bảo vệ cả đọc/kiểm tra quyền/phiên bản/ghi khi có nhiều tiến trình API. Phản hồi thành công chỉ gửi sau commit. Bản hiện tại đã tách bảng nhưng vẫn dùng khóa chung để giữ đúng hành vi đồng thời; chưa tối ưu cho tải ghi lớn.

## Chuyển từ PostgreSQL (quy trình cũ, trước migration quan hệ)

1. Bật PostgreSQL nguồn nếu đã tắt: `npm run db:postgres:start`.
2. Giữ `DATABASE_URL` nguồn trong `.env.local` hoặc đặt `POSTGRES_SOURCE_URL`; schema nguồn mặc định public, có thể đặt `POSTGRES_SOURCE_SCHEMA`.
3. Dừng API PostgreSQL để không ghi thêm sau khi xuất snapshot.
4. Chạy `npm run db:migrate` rồi khởi động API mới.

Công cụ xuất snapshot nhất quán của cả bốn bảng dưới khóa PostgreSQL, ghi bản sao vào `.data/backups/postgres-before-sqlserver-*.json`, rồi nhập trong một transaction SQL Server. Đối chiếu toàn bộ tài liệu JSON và từng hàng xác thực/phiên/giới hạn trước commit; sai khác hoặc lỗi nhập làm rollback. Đích đã có bất kỳ dữ liệu ứng dụng nào sẽ bị từ chối, không ghi đè. Bản sao chứa hash xác thực và dữ liệu nghiệp vụ, chỉ lưu riêng trên máy. Báo cáo `sqlserver-migration-*.json` ghi số lượng và checksum, không ghi mật khẩu.

PostgreSQL, SQLite cũ và mã chuyển đổi cũ được giữ lại, không xóa file. Có thể dừng PostgreSQL riêng của dự án sau khi chuyển xong bằng `npm run db:postgres:stop`; SQL Server không phụ thuộc PostgreSQL. Sau khi có ghi mới vào SQL Server, nguồn PostgreSQL cũ không còn phản ánh các thay đổi mới.

## Sao lưu SQL Server

Dùng Backup trong SQL Server Management Studio cho database `QuanTriKPI`, chọn tên tệp mới và vị trí dịch vụ SQL Server có quyền ghi. Bản sao database sẽ chứa cả các bảng dbo sẵn có và schema ứng dụng. Không ghi đè/khôi phục lên database đang có dữ liệu cần giữ. Không sao chép trực tiếp MDF/LDF đang hoạt động để thay cho backup.

## Kiểm thử

```powershell
npm test
npm run build
npm run test:api
npm run test:migration
npm run test:e2e
```

Các bài API/migration dùng schema `test_*`, E2E dùng `e2e_*`, giữ lại để kiểm tra. Không thử trên schema ứng dụng chính hoặc dbo. `test:migration` cần cả PostgreSQL nguồn thử và SQL Server, các bài còn lại chỉ cần SQL Server. Tài khoản Windows kiểm thử cần quyền tạo schema/bảng trong database; khi vận hành giới hạn quyền theo môi trường.

Đã đối chiếu dự án mã nguồn mở [node-mssql](https://github.com/tediousjs/node-mssql) về Windows Authentication, binding tham số và transaction, cùng [Microsoft sp_getapplock](https://learn.microsoft.com/en-us/sql/relational-databases/system-stored-procedures/sp-getapplock-transact-sql). Không sao chép mã nguồn dự án khác.
