# QuanTriKPI — Frontend và Backend

Ứng dụng quản trị điều hành và theo dõi nhiệm vụ, sử dụng React/TypeScript và backend Node.js kết nối Microsoft SQL Server.

## Mã nguồn

- `frontend/src/`: giao diện React, phân hệ và quy tắc nghiệp vụ.
- `frontend/server/`: backend HTTP, xác thực, phân quyền, API và lưu SQL Server.
- `frontend/scripts/`: chạy ứng dụng, kiểm tra kết nối, chuyển dữ liệu và kiểm thử API.
- `frontend/tests/`: kiểm thử trình duyệt.

Backend nằm trong `frontend/server/` để sử dụng chung kiểu dữ liệu và quy tắc với giao diện. Dự án chạy cả hai phần bằng `npm run dev`.

## Chạy trên Windows

Yêu cầu Node.js 24+, SQL Server 2019+ (ví dụ SQL Server Express), ODBC Driver 17 và tài khoản Windows có quyền trong database ứng dụng.

1. Tạo database `QuanTriKPI` nếu máy chưa có. Không ghi đè database đã có dữ liệu.
2. Chuẩn bị cấu hình và cài thư viện:

```powershell
cd frontend
npm ci --cache .npm-cache
Copy-Item .env.example .env.sqlserver.local
```

3. Chỉnh `.env.sqlserver.local` cho đúng SQL Server trên máy. Mẫu sử dụng `.\SQLEXPRESS`, Windows Authentication và schema riêng `quantrikpi_app`. `Encrypt=No` trong mẫu chỉ dành cho kết nối cục bộ.
4. Với database/schema mới trống, chạy:

```powershell
npm run db:check
npm run setup
npm run dev
```

Mở địa chỉ Vite in ra, thường là http://127.0.0.1:5173. API mặc định tại http://127.0.0.1:3001 và được giao diện proxy qua `/api`.

`setup` tạo dữ liệu mẫu và mật khẩu ngẫu nhiên. Thông tin tài khoản chỉ được ghi tại `frontend/.data/tai-khoan-ban-dau.txt` trên máy chạy; không đưa tệp này lên GitHub. Repository không chứa cơ sở dữ liệu hoặc tài khoản thật trên máy tác giả.

Nếu có dữ liệu PostgreSQL cũ cần chuyển, làm theo [hướng dẫn SQL Server](frontend/server/SQLSERVER.md) trước khi chạy `setup`. Các bảng dbo đã có được giữ riêng; ứng dụng dùng schema `quantrikpi_app` và hiện lưu nghiệp vụ trong tài liệu JSON.

## Kiểm tra

```powershell
cd frontend
npm test
npm run build
npm run test:api
npm run test:e2e
```

Các bài tích hợp cần SQL Server và quyền tạo schema kiểm thử riêng. `npm run test:migration` cần thêm PostgreSQL nguồn thử.

Xem thêm [tài liệu ứng dụng](frontend/README.md), [kết nối SQL Server](frontend/server/SQLSERVER.md) và [API v1](frontend/server/API-v1.md).
