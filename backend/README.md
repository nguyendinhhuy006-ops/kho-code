# Backend QuanTriKPI

Mã nguồn backend riêng, giữ server/ và src/ vì backend dùng chung domain và dữ liệu mẫu trong src/.

Yêu cầu: Windows, Node.js 24+, SQL Server và ODBC Driver 17 for SQL Server.

1. Giải nén, mở terminal trong thư mục này, chạy npm ci.
2. Sao chép .env.example thành .env.sqlserver.local và chỉnh kết nối SQL Server phù hợp.
3. Chạy npm run db:check để kiểm tra kết nối.
4. Chạy npm start. API mặc định: http://127.0.0.1:3001, kiểm tra /api/health.

Không kèm cơ sở dữ liệu thực, tệp mật khẩu, cấu hình riêng hoặc frontend. Cần chuẩn bị database/schema phù hợp; đọc server/SQLSERVER.md và server/SQL-RELATIONAL.md trước khi dùng với dữ liệu hiện có. Tài liệu server có một số lệnh của dự án đầy đủ; gói này cung cấp start, api, setup và db:check. Setup có thể khởi tạo dữ liệu trên database được cấu hình.
