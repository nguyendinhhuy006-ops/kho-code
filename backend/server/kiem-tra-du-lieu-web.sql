-- Chỉ đọc: chạy trong SQL Server Management Studio.
USE [QuanTriKPI];

SELECT MaTaiKhoan, MaDonVi, HoTen, Email, VaiTro, TrangThai
FROM dbo.TaiKhoan ORDER BY ThuTu;

SELECT MaDonVi, TenDonVi FROM dbo.DonVi ORDER BY ThuTu;
SELECT MaNamHoc, TenNamHoc FROM dbo.NamHoc ORDER BY ThuTu;
SELECT MaChienLuoc, TenChienLuoc, MoTa FROM dbo.ChienLuoc ORDER BY ThuTu;
SELECT MaKeHoach, TenKeHoach, MaDonVi, MaNamHoc, TrangThai FROM dbo.KeHoach ORDER BY ThuTu;
SELECT MaNhiemVu, TenNhiemVu, MaTaiKhoan, PhanTramHoanThanh, TrangThai FROM dbo.NhiemVu ORDER BY ThuTu;
SELECT MaKPI, TenKPI, MaTaiKhoan, MucTieu, KetQuaThucTe, TrangThai FROM dbo.KPI ORDER BY ThuTu;
SELECT MaNhatKy, NguoiThucHien, HanhDong, ThoiGian FROM dbo.NhatKy ORDER BY ThuTu;

-- Chỉ hiển thị có mật khẩu hay chưa; không in salt/hash hoặc mật khẩu rõ.
SELECT MaTaiKhoan, Email, CoMatKhau FROM dbo.vwTaiKhoanDangNhap ORDER BY ThuTu;
