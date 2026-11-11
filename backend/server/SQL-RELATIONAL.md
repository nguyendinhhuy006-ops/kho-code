# Dữ liệu web trong bảng quan hệ SQL Server

## Nguồn dữ liệu sau chuyển đổi

Backend đọc và ghi trực tiếp các bảng dưới đây trong database `QuanTriKPI`. Không có tiến trình sao chép định kỳ giữa JSON và các bảng. Khi sửa từ web, transaction ghi vào các bảng này; khi tải lại dữ liệu, backend đọc lại chính các bảng đó.

| Dữ liệu web | Bảng SQL Server |
| --- | --- |
| Tài khoản, vai trò, trạng thái | `dbo.TaiKhoan` |
| Thông tin xác thực đã băm | `dbo.ThongTinDangNhap` |
| Đơn vị | `dbo.DonVi` |
| Năm học | `dbo.NamHoc` |
| Chiến lược | `dbo.ChienLuoc` |
| Kế hoạch | `dbo.KeHoach` |
| Nhiệm vụ, người nhận, tiến độ, minh chứng | `dbo.NhiemVu` |
| Chỉ tiêu, kết quả, kỳ và minh chứng | `dbo.KPI` |
| Nhật ký nghiệp vụ | `dbo.NhatKy` |
| Ma trận quyền đã tùy chỉnh | `dbo.TrangVaiTro`, `dbo.QuyenVaiTro`, `dbo.CauHinhUngDung` |
| Phiên đăng nhập và bộ đếm nhập sai | `quantrikpi_app.sessions`, `quantrikpi_app.attempts` |
| Metadata và nội dung tệp minh chứng chỉ tiêu | `quantrikpi_app.attachments` (VARBINARY(MAX), khóa ngoại sang KPI) |

`quantrikpi_app.storage_config` cho biết backend đã chuyển sang schema `dbo`. Các schema kiểm thử dùng đích riêng có tiền tố `test_`/`e2e_`, không dùng `dbo` thật.

Mã bản ghi dùng chuỗi như trên web, không còn dùng mã số của bộ dữ liệu cũ. Cột `ThuTu` giữ thứ tự danh sách. Các trạng thái và mã vai trò dùng đúng giá trị của web: `ADMIN`, `BGH`, `TDV`, `GV`.

Mật khẩu không lưu dạng rõ. `dbo.ThongTinDangNhap` lưu salt và hash scrypt; view `dbo.vwTaiKhoanDangNhap` ghép tài khoản với trạng thái có mật khẩu và hash. Không gõ mật khẩu rõ vào cột hash. Đổi/cấp lại mật khẩu từ chức năng quản lý tài khoản trên web để giữ đúng băm và thu hồi phiên. `tk.md` là thông tin ban đầu, không tự cập nhật khi đổi mật khẩu.

Sửa thông tin hợp lệ trực tiếp trong SQL sẽ xuất hiện khi web tải lại dữ liệu. SQL quản trị viên có thể bỏ qua kiểm tra nghiệp vụ ở API, vì vậy nên thực hiện nghiệp vụ qua web. Khi sửa SQL trong lúc ứng dụng chạy, dùng transaction và cùng `sp_getapplock` resource `quantrikpi:quantrikpi_app`, owner `Transaction`, mode `Exclusive` để tránh ghi đè cập nhật đang diễn ra. Không sửa các hash, phiên hoặc bộ đếm trực tiếp.

## Giữ nguyên dữ liệu cũ

Migration lưu nguyên 11 bảng nghiệp vụ `dbo` cũ vào `quantrikpi_legacy_20261110`, gồm cả `MucTieu`, `PhanCong`, `TienDo`, `DanhGiaKPI`, `ThongBao`. Những bảng này không phải nguồn dữ liệu hiện tại của web. Các cột tương ứng của chức năng web nằm trong `KeHoach`, `NhiemVu`, `KPI`; cảnh báo được tính từ hạn và trạng thái, không có bảng thông báo đã đọc/chưa đọc trong chức năng web hiện tại.

Ảnh chụp JSON cũ và bảng mật khẩu cũ cũng chuyển sang schema lưu trữ, dưới tên `state` và `credentials`. Không nhập hai tài khoản cũ vào web vì chưa có ánh xạ vai trò và đơn vị phù hợp. Chúng được giữ nguyên trong bảng lưu trữ.

Trước khi chuyển, tạo bản backup toàn database bằng `BACKUP DATABASE ... WITH COPY_ONLY,CHECKSUM`, chạy `RESTORE VERIFYONLY`, rồi xuất snapshot cục bộ trong `.data/backups`. Snapshot có dữ liệu xác thực nên không tải lên Git/Vercel hoặc chia sẻ công khai.

## Thực hiện và kiểm tra

1. Dừng các API đang dùng schema chính để không có tiến trình cũ ghi vào nguồn JSON.
2. Chạy `npm run db:relational` bằng phiên Windows có quyền với SQL Server. Lệnh từ chối chạy lại hoặc ghi đè schema không mong đợi.
3. Migration chạy trong transaction và khóa ứng dụng, đối chiếu đầy đủ dữ liệu, hash mật khẩu, phiên, bộ đếm và bảng cũ trước commit. Nếu lỗi, rollback toàn bộ thay đổi schema/dữ liệu.
4. Khởi động lại backend local/online. Cloudflare Tunnel và cấu hình Vercel giữ nguyên nếu tunnel chưa dừng.
5. Mở lại SSMS hoặc Refresh Object Explorer; đóng cửa sổ Edit Rows đang giữ metadata cũ, mở lại bảng `dbo.TaiKhoan`.

Kiểm tra chỉ đọc:

```sql
USE QuanTriKPI;
SELECT MaTaiKhoan, MaDonVi, HoTen, Email, VaiTro, TrangThai FROM dbo.TaiKhoan ORDER BY ThuTu;
SELECT COUNT(*) AS SoTaiKhoan FROM dbo.TaiKhoan;
SELECT COUNT(*) AS SoMatKhau FROM dbo.ThongTinDangNhap;
SELECT MaKeHoach, TenKeHoach, MaDonVi, MaNamHoc, TrangThai FROM dbo.KeHoach ORDER BY ThuTu;
SELECT MaNhiemVu, TenNhiemVu, MaTaiKhoan, PhanTramHoanThanh FROM dbo.NhiemVu ORDER BY ThuTu;
```

Kiểm thử riêng: `npm run test:relational`; `$env:TEST_RELATIONAL='1'; npm run test:api`; `$env:E2E_RELATIONAL='1'; npm run test:e2e`.

Đã đối chiếu mô hình transaction/tham số của [node-mssql](https://github.com/tediousjs/node-mssql) và cách khai báo entity/migration của [TypeORM](https://github.com/typeorm/typeorm). Tiếp tục dùng driver hiện tại, không bật đồng bộ schema tự động của ORM.
