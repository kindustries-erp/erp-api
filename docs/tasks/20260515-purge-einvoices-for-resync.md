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
- In-scope: Xóa toàn bộ bản ghi trong collection `einvoices` qua Directus API nội bộ.
- Out-of-scope: Xóa cấu hình cổng thuế, xóa code, hoặc thực hiện bất kỳ lệnh ghi/xóa nào lên API GDT.

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
- [ ] 2.0 DB: Backup/Snapshot bảng einvoices (khuyến nghị)
- [ ] 3.0 DB: Thực hiện lệnh xóa toàn bộ bản ghi trong `einvoices`
- [ ] 4.0 Validate
  - [ ] 4.1 Kiểm tra count `einvoices` trong Directus trả về 0
  - [ ] 4.2 Kiểm tra UI ERP mục Hóa đơn điện tử (bảng trống)
- [ ] 5.0 Close
  - [ ] 5.1 Lessons learned entry
  - [ ] 5.2 Summary with evidence

## Risk & Rollback
- **Risk:** Mất toàn bộ lịch sử hóa đơn và các liên kết với phiếu chi/phiếu nhập (nếu có) trong ERP. Không thể khôi phục nếu không có backup DB.
- **Rollback:** Restore lại snapshot DB nếu có lỗi phát sinh.

## Validation Evidence
- DB precheck result: `DB_READY`
- Build: N/A (Không đổi code)
- Smoke: `GET /items/einvoices?meta=total_count` trả về `total_count: 0`.

## Sẵn sàng thực thi
Dừng tại đây chờ xác nhận của user để thực hiện lệnh xóa DB.
