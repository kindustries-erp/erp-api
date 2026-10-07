---
name: download-provider-invoice-pdf
description: Quy trình chuẩn bóc tách mã tra cứu từ XML, tự động tải tệp PDF gốc từ các cổng Nhà Cung Cấp Hóa Đơn (HILO, MISA, CyberBill, VinFast, EasyInvoice...) và đồng bộ lưu trữ lên S3 RustFS / Cloudflare R2 kèm liên kết erp_attachments.
---

# 📥 Download Provider Invoice PDF & RustFS Ingestion Standard

Skill này cung cấp toàn bộ tri thức, quy trình kỹ thuật và hướng dẫn vận hành để **tự động bóc tách mã tra cứu từ tệp XML hóa đơn điện tử**, kết nối trực tiếp cổng tra cứu của **Nhà Cung Cấp (NCC)** để tải về **bản PDF gốc có chữ ký số điện tử hợp pháp**, và lưu trữ an toàn vào cụm lưu trữ đối tượng **RustFS (S3-compatible) / Cloudflare R2** của Liouni ERP.

---

## 1. Nguyên Tắc Cốt Lõi (Mandatory Principles)

1. **Tuyệt đối KHÔNG convert từ XML/HTML sang PDF:**
   - Cơ chế giả lập PDF từ XML/HTML cũ đã bị loại bỏ hoàn toàn khỏi hệ thống vì không có giá trị pháp lý và làm sai lệch biểu mẫu hóa đơn của nhà cung cấp.
   - Chỉ lưu trữ và hiển thị **PDF gốc chuẩn từ cổng nhà cung cấp** (`pdf_source = 'provider_original'`) hoặc file do người dùng upload trực tiếp (`pdf_source = 'manual_upload'`).
2. **Ưu tiên cấu hình môi trường DB & RustFS:**
   - Toàn bộ script và dịch vụ backend đọc cấu hình từ [erp/erp-api/.env](file:///home/dev/repos-dev-02/erp/erp-api/.env) (`erp_greenway_production` port `5433`, S3 endpoint `https://s3.liouni.com/`, bucket `erp-greenway-production`).
   - Bỏ qua các file môi trường cục bộ `.env.local` nếu có xung đột cấu hình.
3. **Quy chuẩn liên kết kép (Unified Attachments & Legacy Compatibility):**
   - File PDF sau khi lưu vào RustFS phải được:
     1. Ghi vào `erp_invoices.pdf_file_key = 'invoices/pdf/{id}.pdf'` và `pdf_source = 'provider_original'`.
     2. Tạo bản ghi chính quy trong `erp_attachments` với tên tệp chuẩn hóa: `{YYYY-MM-DD}_{serialNo}_{invoiceNo}.pdf` (vd: `2026-09-30_C26TSG_119.pdf`), dung lượng thực và `document_type = 'HOA_DON'`.
     3. Tạo bản ghi liên kết trong bảng `erp_invoice_attachments (invoice_id, attachment_id)`.
4. **Khử trùng hiển thị giao diện (Zero-Duplicate UI Guard):**
   - Trong `InvoiceDocumentWorkspace.helper.ts`, nếu `pdfFileKey` trùng với `fileKey` trong `erp_attachments`, hệ thống bắt buộc hợp nhất và ưu tiên lấy bản ghi từ `erp_attachments` (hiển thị đúng 1 dòng với badge `PDF gốc` và dung lượng tệp, tránh double file).

---

## 2. Bản Đồ Nhà Cung Cấp & Cơ Chế Tra Cứu (Provider Matrix)

| Nhà Cung Cấp | Dấu hiệu nhận diện trong XML | Mã tra cứu (Lookup Key) | Cổng tra cứu | Cơ chế tải tự động (Adapter) | Trạng thái tự động |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **HILO (GSM Xanh SM)** | MST bán `0110269067` hoặc thẻ `<TTruong>Hilo-SearchKey</TTruong>` | `Hilo-SearchKey` (chuỗi 26 ký tự) | `https://gsm-einvoice.hilo.com.vn/` | `HiloInvoiceAdapter` | 🟢 **100% Tự động** (không captcha) |
| **MISA (meInvoice)** | `MSTTCGP = 0101243150` hoặc domain `meinvoice.vn` | `TransactionID` (`<DLHDon Id="...">` hoặc `<TTruong>TransactionID</TTruong>`) | `https://www.meinvoice.vn/tra-cuu/` | `MisaInvoiceAdapter` | 🟢 **100% Tự động** (bỏ qua Cloudflare) |
| **CyberBill (CyberLotus)** | `MSTTCGP = 0105232093` / `0108399589` hoặc thẻ `<MaTraCuu>`, `<DLHDon Id="ID-...">` | `MaTraCuu` (bỏ tiền tố `ID-`) | Cụm 1: `https://tracuu.cyberbill.vn`<br>Cụm 2: `https://tracuuhoadon.cyberbill.vn` | `CyberbillInvoiceAdapter` | 🟢 **100% Tự động** (AI Vision Captcha Solver + Auto-Cluster Fallback) |
| **VinFast / Vingroup** | MST bán `0100684378` / `0108927926` / `0108926276`, hoặc thẻ `<Salt>`, `<MaTraCuu>` | Salt / MaTraCuu | `https://e-invoice-tt78.vingroup.net/TraCuu/SearchBySalt` | `VinfastInvoiceAdapter` | 🟡 Bị WAF F5/Cloudflare, portal tra cứu Salt không trả về dữ liệu (Xem mục 3.4) |
| **Softdreams EasyInvoice**| `MSTTCGP = 0105987432` hoặc `<Fkey>`, `<PortalLink>` | Fkey | Subdomain theo người bán hoặc `tracuu.easyinvoice.vn` | `EasyInvoiceAdapter` | 🟡 Form yêu cầu captcha ảnh |
| **Viettel S-Invoice** | `MSTTCGP = 0100109106` | ReservationCode / Mã bí mật | `https://sinvoice.viettel.vn/tracuuhoadon` | `ViettelInvoiceAdapter` | 🟡 XML GDT thường không có mã bí mật |

---

## 3. Chi Tiết Kỹ Thuật Từng Adapter Tự Động

### 3.1. HILO Invoice Adapter (`HiloInvoiceAdapter`)
* **File:** [hilo-invoice.adapter.ts](file:///home/dev/repos-dev-02/erp/erp-api/src/erp-invoices-core/services/adapters/hilo-invoice.adapter.ts)
* **Luồng xử lý:**
  1. `GET https://gsm-einvoice.hilo.com.vn/`: Trích xuất session cookie và token ẩn `__RequestVerificationToken`.
  2. `POST https://gsm-einvoice.hilo.com.vn/`: Form `Filter.SearchKey={searchKey}` kèm verification token.
  3. Phân tích HTML response bằng regex tìm hàm gọi template: `ShowInvTemplate('([0-9a-fA-F-]+)'`.
  4. `GET https://gsm-einvoice.hilo.com.vn/Inv/GetPdf?ID={hiloInvId}`: Tải trực tiếp stream nhị phân của tệp PDF.
  5. Kiểm tra tính hợp lệ bằng magic bytes `%PDF` và dung lượng tối thiểu (> 500 bytes).

### 3.2. MISA meInvoice Adapter (`MisaInvoiceAdapter`)
* **File:** [misa-invoice.adapter.ts](file:///home/dev/repos-dev-02/erp/erp-api/src/erp-invoices-core/services/adapters/misa-invoice.adapter.ts)
* **Luồng xử lý:**
  1. `GET https://www.meinvoice.vn/tra-cuu/`: Khởi tạo session ASP.NET và lưu trữ các cookie (`_msid`, `TS01c1f2f5`).
  2. `POST https://www.meinvoice.vn/tra-cuu/GetInvoiceDataByTransactionID`:
     * Header bắt buộc: `Content-Type: application/x-www-form-urlencoded; charset=UTF-8`, `X-Requested-With: XMLHttpRequest`.
     * Body: `transactionID={transactionId}` (không gửi raw JSON).
     * Phản hồi: Nhận JSON chứa token phiên dùng 1 lần trong trường `customData` (vd: `WP_05MNG`).
  3. `GET https://www.meinvoice.vn/tra-cuu/DownloadHandler.ashx?Type=pdf&Viewer=1&ext={customData}&Code={transactionId}`:
     * Header: `Accept: application/pdf,text/html,*/*`, `Referer: https://www.meinvoice.vn/tra-cuu/`.
     * Phản hồi: Tệp PDF gốc hoàn chỉnh (~500 KB - 1 MB) có đầy đủ chữ ký điện tử.

### 3.3. CyberBill Adapter (`CyberbillInvoiceAdapter`)
* **File:** [cyberbill-invoice.adapter.ts](file:///home/dev/repos-dev-02/erp/erp-api/src/erp-invoices-core/services/adapters/cyberbill-invoice.adapter.ts)
* **Đặc tính kỹ thuật:**
  * **Hỗ trợ Đa Cluster:** Tự động điều hướng giữa **Cluster 1** (`https://bill1app.xcyber.vn`, portal `https://tracuu.cyberbill.vn`) và **Cluster 2** (`https://bill2app.xcyber.vn`, portal `https://tracuuhoadon.cyberbill.vn`).
  * **Tự động chuyển cụm khi `status: 4`:** Nếu Cluster 1 trả về `status: 4` (không tìm thấy trên hệ thống mới, yêu cầu tra cứu trên link dự phòng), adapter tự động chuyển sang Cluster 2 mà không gián đoạn luồng.
  * **Giải Captcha AI Vision:** Gọi [invoice-captcha-solver.service.ts](file:///home/dev/repos-dev-02/erp/erp-api/src/erp-invoices-core/services/original-pdf/invoice-captcha-solver.service.ts) qua Gateway 9router (`ag/gemini-3.8-flash` với `stream: false`).
* **Luồng xử lý:**
  1. `POST /api/services/hddt/TraCuuHoaDon/RefreshCaptcha`: Lấy `key` phiên và ảnh JPEG captcha Base64.
  2. Giải captcha ảnh qua AI Vision thành chuỗi 5 chữ số.
  3. `POST /api/services/hddt/TraCuuHoaDon/TraCuu`: Gửi `{ key, captcha, doanhNghiep_MST, maSoBiMat }`.
  4. Lấy `sessionKey` từ kết quả tra cứu (`searchResult.key`).
  5. `POST /api/services/hddt/TraCuuHoaDon/DownloadPdf`: Gửi `{ key: sessionKey, doanhNghiep_MST, maSoBiMat }` -> nhận `fileToken`.
  6. `GET /File/DownloadTempFile?fileType=text/xml&fileToken={fileToken}&fileName={fileName}`: Tải stream nhị phân của tệp PDF gốc.

### 3.4. Đặc Thù Hóa Đơn VinFast & So Sánh Bản In PDF vs invoice.html trong Gói ZIP
* **Cổng tra cứu gốc của Vingroup:**
  * URL cổng portal: `https://e-invoice-tt78.vingroup.net/TraCuu/SearchBySalt` (Route backend: `/HomVinNoLogin/SearchBySalt`).
  * Thực trạng bảo mật: Cổng được bảo vệ bởi giải pháp VNPT-Vinaphone kết hợp WAF F5/Cloudflare. Mặc dù captcha `/CaptchaVin/Show` có thể giải tự động qua AI Vision, cổng portal Vingroup không hỗ trợ tra cứu hóa đơn trực tiếp chỉ bằng chuỗi Salt trích xuất từ XML của Tổng cục Thuế. Vì vậy, các bản PDF gốc hiện tại trong CSDL (242/979 hóa đơn) chủ yếu được kế toán tải về thủ công qua email hoặc portal lúc mua hàng.
* **So sánh UI giữa Bản PDF gốc VinFast (Vingroup/VNPT SAP) và file `invoice.html` trong gói ZIP:**
  * **Bản PDF gốc VinFast (`vinfast_83100.pdf`):**
    * Có **Logo VinFast (chữ V cánh chim màu bạc)** to rõ ở góc trên bên trái.
    * Tiêu đề **song ngữ Anh - Việt** (`HÓA ĐƠN GIÁ TRỊ GIA TĂNG / VAT INVOICE`).
    * Số hóa đơn in **màu ĐỎ ĐẬM** (`00083100`).
    * Có các trường quản trị nội bộ SAP đặc thù: `Số chứng từ trên SAP (Doc. No. in SAP)`, `Phiếu xuất kho số (Delivery No.)`, `VPoint tích lũy`.
    * Nền **trắng trơn**, lề văn bản chuẩn A4 in ấn, viền sạch sẽ.
    * Khung chữ ký số viền đỏ, có dấu tick xanh chìm.
  * **File `invoice.html` trong gói ZIP (ví dụ `K26TAM - 45489`):**
    * Là **template chung của CyberLotus / FastCA** (nhà giải pháp chữ ký số / đóng gói XML độc lập).
    * **Không có logo VinFast** (thay vào đó là placeholder QR code rỗng).
    * Chỉ có tiếng Việt, **không có** số chứng từ SAP, không có phiếu xuất kho, không có điểm VPoint.
    * Nền có **hoa văn chìm hình Trống đồng Đông Sơn màu vàng cam** (`viewinvoice-bg.jpg`) và **viền kép đôi màu nâu đồng**.
    * Bảng hàng hóa chia 10 cột theo mẫu NĐ123 phổ thông, tổng tiền tách 2 bảng ngang song song.
  * **Kết luận:** File `invoice.html` trong gói ZIP **không giống** với bản PDF gốc xuất từ cổng Vingroup (độ tương đồng < 30%). Do đó, hệ thống không render tệp HTML này thay thế bản PDF gốc để tránh gây hiểu nhầm cho kế toán.

---

## 4. Kiến Trúc Backend Module (`erp-api`)

```mermaid
flowchart TD
    XML[XML File from GDT / S3] --> Detector[InvoiceProviderDetectorService]
    Detector -->|Provider Code + Lookup Code| Facade[InvoiceOriginalPdfFacade]
    Facade --> Registry[ProviderAdapterRegistry]
    Registry -->|HILO / GSM| HiloAdapter[HiloInvoiceAdapter]
    Registry -->|MISA| MisaAdapter[MisaInvoiceAdapter]
    Registry -->|CYBERBILL| CyberbillAdapter[CyberbillInvoiceAdapter]
    Registry -->|VINFAST| VinfastAdapter[VinfastInvoiceAdapter]
    Registry -->|Others| OtherAdapters[...]
    CyberbillAdapter <-->|Vision API| CaptchaSolver[InvoiceCaptchaSolverService]
    HiloAdapter -->|PDF Buffer| Worker[InvoicePdfDownloadWorkerService]
    MisaAdapter -->|PDF Buffer| Worker
    CyberbillAdapter -->|PDF Buffer| Worker
    Worker --> RustFS[(RustFS / R2: invoices/pdf/{id}.pdf)]
    Worker --> AttachmentsDB[(erp_attachments & erp_invoice_attachments)]
    Worker --> InvoicesDB[(erp_invoices: pdf_source = provider_original)]
```

### Các lớp dịch vụ trọng yếu:
* [provider-adapter.interface.ts](file:///home/dev/repos-dev-02/erp/erp-api/src/erp-invoices-core/services/adapters/provider-adapter.interface.ts): Định nghĩa contract `IProviderAdapter` (`canHandle`, `downloadOriginalPdf`).
* [provider-adapter.registry.ts](file:///home/dev/repos-dev-02/erp/erp-api/src/erp-invoices-core/services/adapters/provider-adapter.registry.ts): Đăng ký và lựa chọn adapter động theo `providerCode`.
* [invoice-captcha-solver.service.ts](file:///home/dev/repos-dev-02/erp/erp-api/src/erp-invoices-core/services/original-pdf/invoice-captcha-solver.service.ts): Dịch vụ giải captcha qua 9router AI Vision (`gemini-3.8-flash`).
* [invoice-provider-detector.service.ts](file:///home/dev/repos-dev-02/erp/erp-api/src/erp-invoices-core/services/original-pdf/invoice-provider-detector.service.ts): Trích xuất MST TCGP và mã tra cứu từ XML.
* [invoice-pdf-download-worker.service.ts](file:///home/dev/repos-dev-02/erp/erp-api/src/erp-invoices-core/services/original-pdf/invoice-pdf-download-worker.service.ts): Xử lý download nền đa luồng (`concurrency = 3`).

---

## 5. Kịch Bản Tải Hàng Loạt Qua CLI Script (Executable Runner)

Script thực thi chính thức được đặt tại:
👉 [scripts/download-provider-pdf.ts](file:///home/dev/repos-dev-02/erp/erp-api/.agents/skills/download-provider-invoice-pdf/scripts/download-provider-pdf.ts)

### Cách chạy:

1. **Chạy thử nghiệm (Dry-run không ghi dữ liệu):**
   ```bash
   bun .agents/skills/download-provider-invoice-pdf/scripts/download-provider-pdf.ts --month 2026-10 --dry-run
   ```

2. **Tải PDF cho một hóa đơn cụ thể theo ID:**
   ```bash
   bun .agents/skills/download-provider-invoice-pdf/scripts/download-provider-pdf.ts --id <invoice-uuid>
   ```

3. **Tải hàng loạt theo nhà cung cấp (MISA, HILO, hoặc CYBERBILL):**
   ```bash
   # Chỉ tải hóa đơn của CyberBill trong tháng 10:
   bun .agents/skills/download-provider-invoice-pdf/scripts/download-provider-pdf.ts --month 2026-10 --provider cyberbill

   # Chỉ tải hóa đơn của MISA trong tháng 10:
   bun .agents/skills/download-provider-invoice-pdf/scripts/download-provider-pdf.ts --month 2026-10 --provider misa

   # Chỉ tải hóa đơn của HILO / GSM trong tháng 10:
   bun .agents/skills/download-provider-invoice-pdf/scripts/download-provider-pdf.ts --month 2026-10 --provider hilo
   ```

4. **Tải tất cả các nhà cung cấp hỗ trợ tự động (giới hạn 50 hóa đơn):**
   ```bash
   bun .agents/skills/download-provider-invoice-pdf/scripts/download-provider-pdf.ts --month 2026-10 --limit 50
   ```

---

## 6. Kiểm Thử & Đảm Bảo Chất Lượng (Quality Gate)

Trước khi commit code hoặc kết thúc phiên làm việc:
1. **Kiểm tra Unit Test của các Adapter:**
   ```bash
   bun test src/erp-invoices-core/services/adapters/
   ```
   *Yêu cầu:* 100% tests PASS (Hilo, Misa, Cyberbill, Vinfast, Viettel, EasyInvoice).
2. **Kiểm tra TypeScript Backend & Frontend:**
   ```bash
   cd /home/dev/repos-dev-02/erp/erp-api && bunx tsc --noEmit
   cd /home/dev/repos-dev-02/erp/erp-web && bunx tsc --noEmit
   ```
   *Yêu cầu:* 0 lỗi type errors.
3. **Kiểm tra tính toàn vẹn file PDF tải về:**
   - Magic bytes bắt đầu bằng `%PDF-1.4`.
   - Dung lượng > 50 KB.
   - Thử trích xuất văn bản bằng `pdftotext file.pdf -` có chứa số hóa đơn và mã CQT tương ứng.
