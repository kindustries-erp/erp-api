# Task: Kiểm tra tính năng đồng bộ Tổng cục Thuế (Chunking & Throttling)

## Request Input
- Type: TEST | VERIFY
- Mục tiêu: Kiểm tra logic chia nhỏ tháng và delay 3-5s khi đồng bộ hóa đơn từ hoadondientu.gdt.gov.vn. Đảm bảo pageSize chỉ chấp nhận 15, 30, 50.

## Gate 0: DB Precheck
- [x] DB_READY: Table einvoices đã có sẵn và đang hoạt động.
- [ ] DB_GAP_FOUND: Không có.

## Plan
### 1. Database (DB)
- Không thay đổi schema.
- Chuẩn bị dữ liệu: Đảm bảo bảng `einvoices` sạch hoặc có thể phân biệt dữ liệu test.

### 2. API Logic Check
- [ ] Kiểm tra hàm `splitDateRangeIntoMonthlyChunks`: Input khoảng thời gian > 1 tháng phải chia đúng số chunk.
- [ ] Kiểm tra hàm `syncTaxPortal`:
    - pageSize truyền vào ngoài (15, 30, 50) phải fallback về 15.
    - Loop qua các chunk phải có `this.logger.log` về throttling/sleeping.
- [ ] Kiểm tra `fetchFromGdtApi`: URL query string phải chứa `size` và `search` đúng format.

### 3. Verification (UI/Logs)
- [ ] Trigger API qua Postman hoặc CLI.
- [ ] Quan sát logs terminal: Đảm bảo thấy log "Throttling: Sleeping ...ms before next chunk...".
- [ ] Kiểm tra kết quả trả về: Số lượng hóa đơn khớp với dữ liệu trên portal (nếu token còn sống).

## Checklist Realtime
- [ ] Gọi API sync với range 2 tháng.
- [ ] Kiểm tra log delay.
- [ ] Kiểm tra pageSize trong request URL.

## Gate Validations
- [ ] API trả về ok: true.
- [ ] Logs xác nhận có delay giữa các request.

## Risks & Rollback
- Risk: Token GDT hết hạn (401).
- Rollback: Không cần vì không sửa code, chỉ test.

## Evidence List
- [ ] Log output từ NestJS server.
- [ ] Response JSON từ API.

## Sẵn sàng thực thi
