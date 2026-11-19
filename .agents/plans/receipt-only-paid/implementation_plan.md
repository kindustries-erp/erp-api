# Garage: "đã thu" chỉ tính settlement RECEIPT và "còn phải thu" theo số ròng (KINDU-1400)

## Spec
Phiếu chỉ có settlement PAYMENT bị coi là "có settlement" nên đã thu bị đặt 0, còn phải thu thành số gốc (3 vụ chiết khấu lệch 7,324,800 giữa V1 và V2 trên staging). Sửa mọi chỗ "any settlement" thành "có RECEIPT".

## User Review
Đã duyệt: sửa RECEIPT-only, sửa luôn nhóm `extractNetPayableAmount` trên entity, đổi tên tham số `hasSettlement` thành `hasReceipt`. Không UI, không migration.

## Design
- Helper `hasReceiptSettlement` trong `kgara-case-remaining.helper.ts`.
- Writer: sync-case (2 chỗ), garage-cashflow-transaction, legacy-kgara-mirror.
- Reader V1: list-query, customer-cases-detail, completed-cases (export + sheet builder); V2: case-list-enrichment, case-list.mapper (cờ `hasReceipt`).
- Backfill script: `has_s` chỉ RECEIPT.
- Nhóm net: customer-cases-detail, case-settlement-calc, garage-smart-settlement, case-financial.controller dùng `resolveStoredNetPayable`.

## Task Breakdown (Plane KINDU-1400, con 1401-1411)
1.1.1 Gate-0 DB · 2.1.1 helper+rename · 2.2.1-2.2.3 writer · 2.3.1-2.3.2 reader · 2.4.1 backfill · 2.5.1 nhóm net · 4.1.1 QC · 4.1.2 Knowledge Sync.

## Verification
`bun run type:check`; `bunx jest --forceExit src/kgara-api-core src/v2/modules/{cases-garage,debts-flow-garage,debts-garage}`; backfill dry-run staging và production = 0; smoke garage-debts-v2 trên staging 29/29.
