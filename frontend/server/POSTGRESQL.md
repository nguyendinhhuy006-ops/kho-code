# PostgreSQL của QuanTriKPI

> Tài liệu của phiên bản PostgreSQL trước đây. Backend hiện đã chuyển sang SQL Server; xem [SQLSERVER.md](SQLSERVER.md). Các lệnh PostgreSQL được giữ dưới tên `db:postgres:start`/`db:postgres:stop` để phục vụ nguồn dữ liệu cũ. Không chạy hướng dẫn chuyển SQLite bên dưới cho backend đang dùng SQL Server.

API dùng `pg` (node-postgres), yêu cầu `DATABASE_URL`, tự đọc `.env.local` tại thư mục frontend. Node.js 24+. SQLite chỉ dùng để nhập dữ liệu cũ và kiểm thử migration.

## Máy Windows hiện tại

PostgreSQL chạy cục bộ bằng bộ nhị phân từ [embedded-postgres](https://github.com/leinelissen/embedded-postgres), không cần cài dịch vụ hệ thống hoặc Docker. Chỉ lắng nghe `127.0.0.1:55432`, database và tài khoản ứng dụng đều là `quantrikpi`; tài khoản ứng dụng không phải superuser. Mật khẩu ngẫu nhiên và URL nằm trong `.env.local`, không đưa lên Git. Cấu hình quản trị local nằm trong `.data/postgres-local.json`, không chia sẻ công khai.

```powershell
cd frontend
npm install --cache .npm-cache
npm run db:start
npm run dev
```

`db:start` khởi tạo cluster một lần rồi tái sử dụng dữ liệu. Sau khi khởi động lại Windows, chạy lại lệnh này trước API. Muốn dừng: dừng API bằng Ctrl+C rồi `npm run db:stop`. Dữ liệu được giữ nguyên. PostgreSQL local không tự chạy khi khởi động Windows.

Cluster: `.data/postgres`. Nhật ký: `.data/postgres.log`. SQLite cũ và các bản sao được giữ nguyên. Không sao chép riêng thư mục cluster đang hoạt động để làm bản sao lưu.

## Chuyển dữ liệu SQLite

1. Dừng API SQLite cũ để không phát sinh ghi mới trong lúc chuyển.
2. Chạy `npm run db:start`, cấu hình `.env.local` trỏ đến PostgreSQL đích trống.
3. Chạy `npm run db:migrate`. Có thể truyền nguồn khác: `npm run db:migrate -- C:/duong-dan/nguon.sqlite`.
4. Chạy `npm run api` hoặc `npm run dev`.
5. Kiểm tra `/api/health` có `database: "postgresql"`, đăng nhập bằng tài khoản cũ.

Công cụ dùng SQLite Online Backup API tạo bản sao nhất quán trong `.data/backups/`, bao gồm dữ liệu chưa checkpoint trong WAL. Sau kiểm tra toàn vẹn, chuyển cả `state`, `credentials`, `sessions`, `attempts` trong một transaction PostgreSQL và đối chiếu tất cả hàng trước commit. Không giải mã hoặc đổi mật khẩu. Báo cáo JSON ghi số hàng và đường dẫn bản sao, không ghi mật khẩu. Đích có dữ liệu sẽ bị từ chối; không có tùy chọn tự ghi đè. Không xóa bản gốc.

API từ chối tạo dữ liệu mẫu nếu PostgreSQL trống mà thư mục dữ liệu còn SQLite cũ, tránh bỏ qua bước chuyển.

## Cấu trúc

| Bảng | Nội dung |
|---|---|
| `state` | Một tài liệu JSONB chứa nghiệp vụ và cấu hình quyền |
| `credentials` | `user_id`, `salt`, mật khẩu băm bằng scrypt |
| `sessions` | Hash token, người dùng, hạn phiên BIGINT theo mili giây |
| `attempts` | Khóa giới hạn đăng nhập, số lần sai, hạn khóa |

Đã đổi hệ quản trị sang PostgreSQL; chưa tách kế hoạch/nhiệm vụ/chỉ tiêu thành bảng quan hệ hoặc chuyển sang Prisma. Giữ mô hình nghiệp vụ hiện tại và ma trận 96 quyền.

Mỗi yêu cầu API dùng một client trong pool và một transaction. Advisory lock theo database/schema bảo vệ chuỗi đọc → kiểm tra phiên/quyền/phiên bản → ghi tài liệu, kể cả nhiều tiến trình API. Chỉ gửi phản hồi thành công sau commit. Đăng nhập sai vẫn commit bộ đếm. Mô hình một tài liệu cần khóa chung; cần tách bảng trước khi tối ưu lượng ghi đồng thời lớn.

## PostgreSQL bên ngoài

Tạo database trống thuộc sở hữu tài khoản ứng dụng có quyền tạo schema/bảng. Sao chép `.env.example` thành `.env.local`, sửa `DATABASE_URL`. Không cần `db:start` nếu dùng PostgreSQL riêng. `DATABASE_SCHEMA` mặc định `public`; tên schema được kiểm tra và tạo nếu chưa có. Với TLS, cấu hình chứng thư theo dịch vụ, không tắt xác minh chứng thư.

`API_DATA_DIR` chỉ chứa tệp tài khoản ban đầu và dữ liệu phụ, không quyết định database. Dùng `COOKIE_SECURE=true` khi phục vụ HTTPS. `.env.local` và `.data/` bị loại khỏi Git và chặn truy cập bởi Vite.

## Sao lưu và quay lại

Dùng `pg_dump`/`pg_restore` tương ứng phiên bản PostgreSQL; khôi phục vào database trống. Công cụ local trên Windows nằm ở `node_modules/@embedded-postgres/windows-x64/native/bin/`. Ví dụ PowerShell, nhập mật khẩu từ `.env.local` khi công cụ hỏi:

```powershell
& './node_modules/@embedded-postgres/windows-x64/native/bin/pg_dump.exe' -h 127.0.0.1 -p 55432 -U quantrikpi -d quantrikpi -W -Fc -f '.data/backups/quantrikpi-postgres.dump'
```

Dùng tên tệp mới cho mỗi bản sao. SQLite cũ phản ánh thời điểm chuyển; sau khi PostgreSQL nhận ghi mới, quay lại SQLite sẽ thiếu các thay đổi đó. Cần dừng API và chuyển các thay đổi phát sinh nếu muốn quay lại bản cũ.

## Kiểm thử

```powershell
npm test
npm run test:migration
npm run test:api
npm run build
npm run test:e2e
```

API/migration tạo schema `test_*`, E2E dùng `e2e_*`, giữ lại để kiểm tra. API với `NODE_ENV=test` từ chối schema không có tiền tố kiểm thử. Các bài chỉ đặt lại dữ liệu trong schema riêng.

Đã đối chiếu [node-postgres transactions](https://github.com/brianc/node-postgres/blob/master/docs/pages/features/transactions.mdx) về việc dùng cùng client trong transaction và [embedded-postgres](https://github.com/leinelissen/embedded-postgres) về bộ nhị phân PostgreSQL Windows. Không sao chép mã dự án khác.
