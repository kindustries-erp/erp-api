# ERP Core Wave 2 - Manufacturing core detail routes + legacy Directus cleanup

## Scope
- Hoàn tất backend endpoints manufacturing mà FE `MfgItems` đang gọi trên lane `erp-core`
- Xóa legacy module `src/erp-manufacturing` khỏi branch `erp-core` sau khi đã chuyển route sang `erp-mfg-core`

## Changes
1. Mở rộng `src/erp-mfg-core/erp-mfg-core.controller.ts`
   - `POST /api/v1/erp-manufacturing/items/components`
   - `GET /api/v1/erp-manufacturing/items/components/:id`
   - `PATCH /api/v1/erp-manufacturing/items/components/:id`
   - `GET /api/v1/erp-manufacturing/items/components/:id/stock-summary`
   - `GET /api/v1/erp-manufacturing/items/components/:id/txns`
   - `GET /api/v1/erp-manufacturing/purchase-orders/:id`
   - `GET /api/v1/erp-manufacturing/vehicles/:id`

2. Mở rộng `src/erp-mfg-core/erp-mfg-core.service.ts`
   - Thêm create/update/detail cho component
   - Thêm stock summary + transaction history cho component
   - Thêm purchase order detail gồm `lines`
   - Thêm vehicle detail
   - Chuẩn hóa response shape theo FE hiện tại:
     - list endpoints: `{ data, meta }`
     - detail endpoints: raw object

3. Mở rộng `src/erp-mfg-core/erp-mfg-core.module.ts`
   - import thêm `ErpInventoryTransaction`
   - import thêm `ErpPurchaseOrderLine`

4. Xóa legacy Directus manufacturing module:
   - `src/erp-manufacturing/`

## Verification evidence
- Docker image build pass qua stack thật:
  - `docker compose -f /opt/stacks/liouni-erp-core-api/docker-compose.yml --env-file /opt/stacks/liouni-erp-core-api/.env build`
- Redeploy pass:
  - `docker compose -f /opt/stacks/liouni-erp-core-api/docker-compose.yml --env-file /opt/stacks/liouni-erp-core-api/.env up -d --force-recreate`
- Runtime logs xác nhận routes mount thành công:
  - `/api/v1/erp-manufacturing/items/components` GET/POST
  - `/api/v1/erp-manufacturing/items/components/:id` GET/PATCH
  - `/api/v1/erp-manufacturing/items/components/:id/stock-summary` GET
  - `/api/v1/erp-manufacturing/items/components/:id/txns` GET
  - `/api/v1/erp-manufacturing/purchase-orders/:id` GET
  - `/api/v1/erp-manufacturing/vehicles/:id` GET
- Live internal verification qua localhost + JWT seed admin:
  - login: `201`
  - component list/detail/stock-summary/txns/patch: `200`
  - purchase-order list/detail: `200`
  - vehicles list: `200`

## Notes
- `vehicles/:id` chưa verify live vì dataset hiện không có vehicle sample (`sample_vehicle_id = null`), nhưng route đã mount thành công trong Nest logs.
- `stock-summary` hiện trả `lots: []`, `serials: []`, `lot_count: 0`, `serial_count: 0` vì core lane chưa map các bảng lot/serial tương ứng.
- `component` create/update hiện chưa persist `tracking_type` và `notes` vì `erp_inventory_items` core entity hiện chưa có cột tương ứng.
- Legacy Directus modules khác vẫn còn trong repo nhưng không được import vào `AppModule`; riêng manufacturing lane đã được remove hẳn theo yêu cầu.

## Follow-up candidates
- Nếu cần parity 100% với FE advanced stock drawer, bổ sung core entities + mapping cho lots/serials.
- Nếu cần verify `vehicles/:id` end-to-end, seed ít nhất 1 row `erp_vehicles` trên lane `erp-core`.
- Có thể tiếp tục dọn các legacy Directus modules khác đã chuyển xong sang core theo từng domain để tránh xóa quá scope một lượt.
