---
name: bulk-upload-invoice-pdfs
description: Tự động hóa việc upload hàng loạt file PDF hóa đơn lên Cloudflare R2 và map vào database thông qua cột pdf_file_key.
---

# Bulk Upload Invoice PDFs

Skill này hướng dẫn Agent cách đính kèm hàng loạt file PDF hóa đơn vào hệ thống ERP để giao diện hiển thị đúng trạng thái.

## Bối cảnh & Nguyên lý (Context & Theory)

- Trong hệ thống ERP, file PDF của hóa đơn đầu vào (`direction = 'IN'`) có thể bị thiếu (chỉ có XML). Nếu có file cứng lưu ở ổ cứng (vd `erp/data/invoice/input/YYYY-MM`), user sẽ muốn upload lên bucket Cloudflare R2 và lưu đường dẫn vào database.
- Bảng `erp_invoices` có cột `pdf_file_key`. Khi cột này có đường dẫn tới R2 (vd: `invoices/IN/2026/04/ten-file.pdf`), hệ thống sẽ tự động hiển thị biểu tượng PDF ngoài danh sách (`ErpInvoicesTab.tsx`) và cho phép xem trực tiếp trong chi tiết (`ErpInvoicePdfUpload.tsx`).

## Các bước thực hiện (Workflow)

Khi người dùng yêu cầu "Upload hàng loạt PDF hóa đơn", hãy thực hiện các bước sau:

1. **Chuẩn bị cấu hình R2 & DB:**
   - Đọc các biến môi trường từ `erp-api/.env` (như R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME và POSTGRES_URL).
2. **Quét thư mục chứa PDF:**
   - Quét thư mục do người dùng cung cấp (ví dụ `erp/data/invoice/input/2026-04`).
   - Lọc các file có đuôi `.pdf`.

3. **Phân tích tên file:**
   - Tên file có thể không theo một chuẩn cố định (ví dụ không có `YYYYMMDD_HDMH_`), nhưng thường sẽ chứa **Số Hóa Đơn** và/hoặc **Ký Hiệu Hóa Đơn**.
   - Cách tiếp cận tốt nhất là: Truy vấn danh sách hóa đơn đầu vào (`direction = 'IN'`) từ database. Với mỗi file, kiểm tra xem tên file có chứa `invoice_no` (và tùy chọn `serial_no`) hay không. Dùng Regular Expression với word boundaries `\b` để tránh nhận diện nhầm (ví dụ số hóa đơn `119` không được match với chuỗi `1192` trong tên file).
4. **Viết script tự động bằng Node.js / Bun:**
   - Kết nối DB Neon bằng thư viện `pg` hoặc chuỗi `psql` commandline tùy vào số lượng. Khuyến khích viết script `bun` dùng `@aws-sdk/client-s3` và `postgres` (hoặc `pg`).
   - Nhận thêm tham số direction (IN hoặc OUT) để quét đúng loại hóa đơn. VD: `bun run bulk-upload.ts /path/to/pdf IN` hoặc `bun run bulk-upload.ts /path/to/pdf OUT`.
   - Ứng với mỗi file PDF tìm được:
     - Upload lên Cloudflare R2 tại đường dẫn: `invoices/<Direction>/<Năm>/<Tháng>/<Tên File.pdf>`
     - Cập nhật database: `UPDATE erp_invoices SET pdf_file_key = '<R2_KEY>' WHERE invoice_no = '<Số HĐ>' AND direction = '<Direction>';`

5. **Xác nhận với người dùng:**
   - Chạy script, theo dõi log upload.
   - Báo cáo số lượng hóa đơn upload thành công, số hóa đơn không tìm thấy trong DB (nếu có).
   - Mời người dùng tải lại trang danh sách hóa đơn để kiểm tra hiển thị.

## Lưu ý quan trọng

- Logic render UI (component `ErpInvoicePdfUpload`) đã được fix để nhận `pdf_file_key`, mặc định label là `"Hóa đơn PDF"`. Agent không cần sửa UI nữa.
- Chỉ thực hiện UPDATE những record đang bị thiếu PDF (`pdf_file_key IS NULL`) để tránh ghi đè nhầm nếu người dùng đã đính kèm tay.
