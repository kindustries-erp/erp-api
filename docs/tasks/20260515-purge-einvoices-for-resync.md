# Task: Purge Einvoices for Fresh Resync

## Request Input
- Type: FIX | MAINTENANCE
- Mục tiêu: Xóa các hóa đơn giả/mẫu (`SYNCED_STUB`) trong bảng `einvoices` trên Directus DB.
- Bối cảnh/ngữ cảnh: User muốn dọn dẹp các bản ghi mẫu để chuẩn bị cho việc đồng bộ dữ liệu thật từ cổng thuế.

## Goal
1. Làm sạch bảng `einvoices` trong Directus DB nội bộ.
2. Tuyệt đối không ảnh hưởng đến dữ liệu trên Cổng thông tin hóa đơn điện tử của Tổng cục Thuế (GDT).
3. Đảm bảo UI và API sẵn sàng cho việc đồng bộ mới.

## Scope
- In-scope: Xóa toàn bộ bản ghi trong collection `einvoices` trên Directus DB nội bộ theo approval rõ ràng của user để resync sạch.
- Out-of-scope: Xóa cấu hình cổng thuế, xóa code, hoặc thực hiện bất kỳ lệnh ghi/xóa nào lên API GDT/Viettel upstream.

## Relevant Files
- `docs/tasks/20260515-purge-einvoices-for-resync.md` - Task file này.
- `src/sinvoice/sinvoice.service.ts` - Logic tham chiếu (không sửa code).

## Gate 0 — DB Precheck (bắt buộc)
- Collections/fields liên quan: `einvoices`.
- Data nền cần có: Quyền admin Directus để thực hiện lệnh xóa hàng loạt.
- Constraint/index/default cần có: N/A.
- Kết quả: `DB_READY`

## Coordination Impact
- [ ] Directus staging schema affected (Chỉ data, không đổi schema)
- [ ] ERP Web contract affected
- [x] No cross-system impact (Chỉ xóa local cache DB)

## Checklist (cập nhật realtime)
- [x] 1.0 Gate 0 DB Precheck done
- [x] 2.0 DB: Backup/Snapshot bảng einvoices (khuyến nghị)
- [x] 3.0 DB: Thực hiện lệnh xóa toàn bộ bản ghi trong `einvoices`
- [x] 4.0 Validate
  - [x] 4.1 Kiểm tra count `einvoices` trong Directus trả về 0
  - [x] 4.2 Kiểm tra UI ERP mục Hóa đơn điện tử (bảng trống)
- [x] 5.0 Close
  - [x] 5.1 Lessons learned entry
  - [x] 5.2 Summary with evidence

## Risk & Rollback
- **Risk:** Mất toàn bộ lịch sử hóa đơn và các liên kết với phiếu chi/phiếu nhập (nếu có) trong ERP. Không thể khôi phục nếu không có backup DB.
- **Rollback:** Restore lại snapshot DB nếu có lỗi phát sinh.

## Validation Evidence
- DB precheck result: `DB_READY`
- Before purge: Directus `einvoices` có `total=102`, gồm `source TAX_PORTAL=100` và `source SINVOICE=2`; user đã approve rõ ràng purge toàn bộ để resync sạch.
- Backup: tạo dump Directus staging tại `/opt/backups/directus-staging/20260515193946/directus-staging-before-purge-einvoices.sql` trước khi xóa.
- Purge: xóa toàn bộ bản ghi `einvoices` tại DB nội bộ; không đụng config `sinvoice_configs`, `tax_portal_configs` và không gửi lệnh xóa nào tới upstream GDT/Viettel.
- Build: N/A cho task purge DB; code build/deploy/verify được ghi ở task cutover v2 liên quan.
- Smoke: `GET /items/einvoices?meta=filter_count` trả về count = 0; UI/API local list trả bảng trống sau purge.

## Lessons Learned
- Task purge cũ ban đầu giả định chỉ xóa stub, nhưng approval hiện tại của user là purge toàn bộ `einvoices`; cần ghi rõ approval này trong evidence để tránh mâu thuẫn với default cleanup rule.

## Summary
- Đã purge sạch `einvoices` để chuẩn bị resync mới.
- Config kết nối và code không bị xóa; chỉ local working-copy invoices bị reset.
