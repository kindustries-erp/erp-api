# ERP Core Wave 2 - Lot/Serial inventory schema + stock-summary mapping

## Scope
Hoàn tất bước 1 wave 2 manufacturing core: map lots/serials thật vào `stock-summary` và `txns`.

## Background
Sau khi deploy các route detail manufacturing core (task `20260608-204700`), `stock-summary` trả `lots: [], serials: [], lot_count: 0, serial_count: 0` vì DB lane `erp-core` chưa có bảng `erp_inventory_lots` / `erp_inventory_serials`.

## Changes

### DB schema (Neon Postgres)
Tạo 2 bảng mới `IF NOT EXISTS`, non-destructive:
```sql
erp_inventory_lots (
  id uuid PRIMARY KEY,
  item_id uuid,
  lot_code varchar(100) NOT NULL,
  received_qty numeric(18,3) DEFAULT 0,
  issued_qty numeric(18,3) DEFAULT 0,
  expiry_date date,
  created_at / updated_at timestamptz
)

erp_inventory_serials (
  id uuid PRIMARY KEY,
  item_id uuid,
  serial_no varchar(255) NOT NULL,
  status varchar(50) DEFAULT 'IN_STOCK',
  vin_id uuid,
  receipt_line_id uuid,
  created_at / updated_at timestamptz
)
```
Index thêm: `item_id`, `serial_no`.

### Seed sample
Seeded 1 lot + 1 serial cho item `UC5-1780844031194-RMA` để verify live:
- Lot: `LOT-UC5-1780844031194-RMA-001` (received 100, issued 20, expiry 2027-12-31)
- Serial: `SN-UC5-1780844031194-RMA-001` (status `IN_STOCK`)

### Entities mới (inventory-core)
- `src/inventory-core/entities/erp_inventory_lot.entity.ts`
- `src/inventory-core/entities/erp_inventory_serial.entity.ts`

### erp-mfg-core module/service
- `erp-mfg-core.module.ts`: thêm `ErpInventoryLot`, `ErpInventorySerial` vào `TypeOrmModule.forFeature`
- `erp-mfg-core.service.ts`: update `getComponentStockSummary()` query thật từ `lotRepository` + `serialRepository`

## Verification evidence

### Build/redeploy
- `nest build` pass trong 5.1s
- container `liouni-erp-core-api` start clean

### HTTP evidence (localhost:10010, JWT seed admin)
```
GET /api/v1/erp-manufacturing/items/components/{SEEDED_ITEM_ID}/stock-summary
→ 200
{
  "stock": { "lot_count": 1, "serial_count": 1, "on_hand_qty": ..., "txn_count": 1 },
  "lots": [
    { "lot_code": "LOT-UC5-1780844031194-RMA-001", "received_qty": 100, "issued_qty": 20, "on_hand_qty": 80, "expiry_date": "2027-12-31" }
  ],
  "serials": [
    { "serial_no": "SN-UC5-1780844031194-RMA-001", "status": "IN_STOCK" }
  ]
}

GET /api/v1/erp-manufacturing/items/components/{SEEDED_ITEM_ID}/txns?page=1&pageSize=5
→ 200 { "data": [ { "txn_type": "ISSUE", "qty": -12, "source_type": "PRODUCTION_ORDER" } ], "meta": {...} }
```

## Known gap after this task
- `txns` hiện không trả `lot_code` trong mỗi transaction vì `erp_inventory_transactions` core chưa có cột `lot_code`. Để hỗ trợ đầy đủ cần alter table thêm cột hoặc join qua bảng riêng — để wave tiếp theo xem xét khi có nhu cầu FE cụ thể.
