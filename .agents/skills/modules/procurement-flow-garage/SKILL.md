---
name: procurement-flow-garage
description: Orchestrator chuỗi mua garage (PR → PO → nhận hàng GR → sổ tồn garage_stock_*, kèm thông báo sau commit). Core procurement-flow-core + module procurement-flow-garage. Đọc trước khi sửa GR post/cancel, ghi tồn garage hoặc thêm bước vào chuỗi mua.
---

# procurement-flow-garage

## 1. Cấu trúc (/erp-api-structure Phần B)
- Lõi `src/v2/core/procurement-flow-core/` (style `orchestrator`, không entity/controller): `contracts/` (cổng `ProcurementOrderFulfilmentPort`, `ProcurementReceiptStockPort`, `ProcurementFlowEventPort`), `services/abstract-procurement-flow.service.ts` (`runInTransaction`, `applyReceipt`, `revertReceipt`, `publishAfterCommit`).
- Module `src/v2/modules/procurement-flow-garage/`: `GarageProcurementFlowService` (facade, Clean DI một chữ ký), `GarageProcurementFlowStockAdapter` (engine + `INVENTORY_MOVEMENTS_GARAGE_LEDGER`), `GarageProcurementFlowEventsService` (thông báo), `helpers/garage-receipt-flow.helper.ts`. Không controller, không route.
- `GarageGoodsReceiptsCoreModule` import `GarageProcurementFlowModule`; module flow KHÔNG import module GR (chỉ dùng entity theo đường dẫn file) để tránh vòng.

## 2. Luồng
- Post: khóa GR → `validateVoucherTransition` → kiểm khớp PO → `applyGoodsReceipt` (PO) → ghi sổ tồn → POSTED. Lỗi bước nào thì rollback cả chuỗi, không phát sự kiện.
- Cancel (đã POSTED): `revertGoodsReceipt` → `reverse` sổ tồn → CANCELLED.
- Sự kiện `GOODS_RECEIPT_POSTED/CANCELLED` phát sau commit, lỗi chỉ log. Người nhận: người tạo PO (không báo chính người thao tác).

## 3. Lưu ý
- Engine chặn tồn âm và `qty <= 0`.
- Thanh toán/hóa đơn sẽ là orchestration riêng sau này (chưa làm).
- Thêm bước mới: thêm cổng ở lõi + adapter ở module, không gọi chéo service trong facade.

## 4. Cập nhật 2026-11-12: lưu-và-nhập-kho và hoàn nhập có kiểm tra

- `GarageProcurementFlowService.saveAndPost(save)`: lưu phiếu rồi ghi sổ trong MỘT transaction. Thân ghi sổ tách thành `postReceiptIn(manager, emit, id)` để dùng chung cho post riêng và save-and-post.
- `cancelReceipt` gọi `assertGoodsUnused` trước khi đảo: nếu sổ `garage_stock_transactions` có ISSUE/ADJUSTMENT cùng mã hàng và chi nhánh sau thời điểm ghi sổ phiếu thì trả 409 "Hàng đã xuất/điều chỉnh sau khi nhập kho, không thể hoàn nhập".
- Helper: `findReverseBlockedReason` (trả lý do hoặc null) và `assertGoodsUnused` trong `helpers/garage-receipt-flow.helper.ts`.
