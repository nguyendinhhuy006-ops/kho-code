# Tệp minh chứng của kết quả chỉ tiêu

Trong Cập nhật kết quả thực hiện, nhập số thực tế đã đạt theo đơn vị chỉ tiêu. Ví dụ mục tiêu 4 học phần, đã hoàn thành 2 học phần thì nhập 2, tương đương 50% mục tiêu. Hộp hiển thị tên, mục tiêu, đơn vị, cách xác định và tỷ lệ tương ứng của giá trị đang nhập.

Có thể ghi mô tả hoặc chọn ảnh/tài liệu làm minh chứng. Tệp được gửi khi bấm Lưu, cùng transaction cập nhật kết quả. Bỏ lựa chọn trước khi lưu hoặc hủy hộp không tạo tệp trên máy chủ. Tệp đã gửi được xem/tải từ hồ sơ chi tiết; ảnh có xem trước.

- Định dạng: JPG/JPEG, PNG, WebP, PDF, DOCX, XLSX, TXT, CSV. Văn bản TXT/CSV dùng UTF-8.
- Mỗi tệp tối đa 3 MiB, tối đa 5 tệp/lần; tổng request tối đa 10 MiB và tối đa 10 tệp/chỉ tiêu.
- Nội dung ảnh/tài liệu nhị phân được nhận dạng bằng `file-type`, không chỉ tin đuôi tệp hoặc MIME client. SVG/HTML/executable không được hỗ trợ. TXT/CSV tải xuống dạng tệp, không được thực thi trong trang.
- Phải đăng nhập và có quyền xem chỉ tiêu để đọc danh sách hoặc tải tệp. Cập nhật yêu cầu quyền `performance.update`, đúng phạm vi và trạng thái nháp. Quyền/trạng thái được kiểm tra lại sau khi nhận request.
- Trình duyệt kiểm tra Origin và cross-site; upload không nắm khóa database trong thời gian truyền request body.
- Kết quả và tệp lưu nguyên tử; yêu cầu thất bại không lưu kết quả một phần. Có thể trình chỉ tiêu với minh chứng bằng tệp mà không cần điền thêm mô tả. Server tự xác minh tệp đã lưu, không tin cờ do client gửi.

## Nơi lưu

`quantrikpi_app.attachments` chứa metadata, mã chỉ tiêu, người gửi, SHA256 và nội dung VARBINARY(MAX). Có khóa ngoại sang `dbo.KPI` khi dùng lưu trữ quan hệ. Không có thư mục tệp tĩnh công khai. Backup SQL Server bao gồm tệp minh chứng.

`GET /api/indicators/:id/attachments` trả metadata trong phạm vi tài khoản. `GET /api/evidence/:id` tải tệp với cookie xác thực, Cache-Control no-store, Content-Disposition attachment và nosniff. Chỉ ảnh hợp lệ được trả inline khi có `?preview=1`.

`POST /api/indicators/:id/result` nhận multipart với trường `actual`, `evidence`, tối đa 5 phần `files`. Các API JSON cũ tiếp tục hoạt động. Multipart parser dùng Busboy với giới hạn tổng request, từng tệp, số trường và số phần. Chưa có chức năng xóa tệp đã gửi.

Đã đối chiếu [Busboy](https://github.com/mscdex/busboy), [Multer](https://github.com/expressjs/multer) và [file-type](https://github.com/sindresorhus/file-type) trước khi triển khai. Dùng Busboy vì backend hiện là Node HTTP, không thêm Express.
# Minh chứng nhiệm vụ

Ngoài chỉ tiêu KPI, phần **Cập nhật tiến độ** của nhiệm vụ có nút **Chọn tệp hoặc ảnh**. Chọn tệp rồi bấm **Lưu tiến độ** hoặc **Gửi nghiệm thu** để lưu. Nghiệm thu cần tiến độ 100% và có mô tả hoặc ít nhất một tệp đã được máy chủ xác minh. Xem và tải tệp trong hồ sơ chi tiết nhiệm vụ.

Tệp nhiệm vụ lưu trong `quantrikpi_app.task_attachments`, liên kết khóa ngoại với `dbo.NhiemVu`. Dùng cùng giới hạn, kiểm tra định dạng và quyền truy cập như tệp KPI; dữ liệu KPI hiện có giữ nguyên. API: `POST /api/tasks/:id/result?submit=0|1`, `GET /api/tasks/:id/attachments`, tải tệp qua `/api/evidence/:id`. Gửi tiến độ, tệp và trạng thái nghiệm thu trong cùng giao dịch.

