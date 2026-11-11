---
name: inventory-movements-core
description: Lõi v2 nhập / xuất / điều chỉnh kho dùng chung (sổ số dư, sổ giao dịch, lớp giá FIFO, engine cộng/trừ tồn có khóa, nền chứng từ có dòng), và các module garage dùng lõi này. Đọc trước khi sửa tồn kho garage hoặc thêm module kho mới.
---

# Module tri thức: inventory-movements-core

## 1. Ranh giới

- **Lõi** `src/v2/core/inventory-movements-core/`: không có controller, không biết nghiệp vụ hay tên bảng cụ thể.
  - `entities/ledger/`: `BaseStockBalanceEntity`, `BaseStockTransactionEntity`, `BaseStockCostLayerEntity` (cột nền, không gắn bảng). Bảng cụ thể do module khai báo và truyền qua `StockLedgerConfig.tables`. Đặt trong thư mục con để generator `api-workflow-module` không đọc nhầm thành trường nền của header.
  - `entities/base-stock-voucher.entity.ts`: nền header chứng từ (id, status, createdBy, timestamps, isDeleted).
  - `entities/lines/base-stock-voucher-line.entity.ts`: nền dòng chứng từ (itemCode, qty, unitCost, amount, direction). Đặt trong `lines/` vì cùng lý do trên.
  - `dto/base-stock-voucher-line.dto.ts`, `dto/stock-voucher-response.dto.ts`: DTO dòng khi tạo và DTO response chứng từ.
  - `helpers/stock-voucher.mapper.ts`: `toStockMoveLine` (dòng chứng từ → `StockMoveLine`), `fromCreateLineDto`, `toLineResponse`, `toVoucherResponse`.
  - `services/stock-balance.service.ts`: khóa số dư, tạo dòng bằng `ON CONFLICT` theo unique index partial.
  - `services/stock-movement-engine.service.ts`: `post` (cộng/trừ, chặn tồn âm) và `reverse` (đảo đúng giá đã ghi, ghi bút toán `_CANCEL`).
  - `costing/`: `weighted-avg.strategy.ts`, `fifo.strategy.ts`, `costing.factory.ts`.
  - `services/abstract-stock-voucher-command.service.ts`: vòng đời DRAFT → POSTED → CANCELLED. Kiểm trạng thái **trước** khi chạy hook `beforeTransition`.
  - `services/abstract-stock-line-voucher-command.service.ts`: nền chứng từ có dòng (tạo/sửa nháp, xóa mềm, post/cancel gọi engine). Module con khai báo `ledger`, `lineEntity`, `transactionType`, `resolveDirection`.
  - `services/abstract-stock-line-voucher-query.service.ts`: nền đọc (danh sách, chi tiết, số chứng từ theo ngày). Phụ thuộc `goods-receipts-core` (`BaseVoucherEngineService`) để đánh số.
- **Sổ tồn garage** `src/v2/modules/inventory-movements-garage-ledger/`: cấu hình `INVENTORY_MOVEMENTS_GARAGE_LEDGER` (scope `GARAGE`, `WEIGHTED_AVG`) và 3 entity `garage_stock_balances`, `garage_stock_transactions`, `garage_stock_cost_layers`. Module `InventoryMovementsGarageLedgerModule` chỉ đăng ký 3 entity cho TypeORM (autoLoadEntities), không có provider; ba module garage import nó.
- **Module garage** (mỗi module chỉ chứa entity header, entity dòng, DTO, loại giao dịch, chiều, tiền tố số chứng từ):
  - `src/v2/modules/inventory-movements-garage-receipts/`
  - `src/v2/modules/inventory-movements-garage-issues/`
  - `src/v2/modules/inventory-movements-garage-adjustments/`

## 2. Quy tắc

- Tồn không bao giờ âm: xuất thiếu thì ném `BadRequestException`, không cắt về 0.
- Mọi cộng/trừ tồn chạy trong transaction của chứng từ, sau khi đã khóa header.
- Phương pháp giá vốn khai báo ở cấu hình ledger (`INVENTORY_MOVEMENTS_GARAGE_LEDGER`: `WEIGHTED_AVG`), không đổi theo request. Đổi phương pháp khi đã có số dư là sai số tồn cũ.
- Đảo phiếu (`cancel`) không xóa bút toán gốc; chỉ ghi thêm `*_CANCEL`.
- Bảng mới không có tiền tố `erp_`. Bảng nhập garage (module `goods-receipts-garage`) đã đổi tên sang `goods_receipts_garage`, `goods_receipt_lines_garage`, `inventory_balances_garage` (migration `20261108100000`), đã hợp nhất từ 2026-11-11: phiếu nhập garage ghi thẳng sổ `garage_stock_*` (`documentType GOODS_RECEIPT_GARAGE`) qua `procurement-flow-garage`; `inventory_balances_garage` không còn được ghi.
- Tên bảng, `docType` (`GARAGE_STOCK_*`) và giá trị resource RBAC (`garage_stock_*`) đã lưu dữ liệu, không đổi theo tên module.

## 3. Thứ tự đọc khi sửa

1. `services/stock-movement-engine.service.ts` (cộng/trừ, đảo).
2. `services/abstract-stock-line-voucher-command.service.ts` (dòng chứng từ → `StockMoveLine`, gọi engine).
3. Module cụ thể (chỉ chứa entity, loại giao dịch, chiều, tiền tố số chứng từ).

## 4. Trạng thái

- Mã đã có, spec đã pass: lõi (costing, engine, nền chứng từ có dòng) và 3 module garage.
- Đã áp dụng lên `erp_greenway_staging`: `20261106130000` (tạo `stock_*`, sau đó đã được thay thế), `20261106130100` (bảng phiếu garage), `20261106140000` (xóa `stock_*` rỗng, tạo `garage_stock_*`).
- Dữ liệu tồn garage cũ đã chuyển sang `garage_stock_balances` trên staging (1 dòng, qty 0), bằng `scripts/migrate-inventory-movements-garage-balances.ts`.
- UI (erp-web) chưa làm.

## extraData (JSON tùy biến, 2026-11-08)

- **DB**: cột `extra_data jsonb NOT NULL DEFAULT '{}'` (CHECK: object) trên: `garage_stock_receipts`, `garage_stock_receipt_lines`, `garage_stock_issues`, `garage_stock_issue_lines`, `garage_stock_adjustments`, `garage_stock_adjustment_lines`. Migration `20261108120000-add-extra-data-to-v2-tables.ts`. Dữ liệu cũ là `{}`.
- **DTO**: field `extraData?: Record<string, unknown>` (`@ExtraDataField()`, base-core). Không gửi thì không đổi.
- **Ghi**: tạo mặc định `{}`. Sửa header merge cấp 1 (`null` xóa key). Dòng chứng từ ghi theo payload, không merge.
- **Giới hạn**: 16 KB, sâu 5 cấp, key ≤ 64 ký tự, cấm `__proto__`/`constructor`/`prototype` (400 qua `RejectUnsafeExtraDataPipe` và service).
- **Response**: luôn có `extraData` (object).
