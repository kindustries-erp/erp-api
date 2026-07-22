# Inventory Core Refactor Plan (No Behavior Change)

## 1) Muc tieu

- Tach service lon thanh cac service nho theo domain, theo pattern da ap dung o module erp-invoices-core.
- Khong thay doi API contract, route, request DTO, response shape, status code, message text, query semantics, permission guard.
- Khong doi dependency boundary voi module khac (dac biet dashboard-core dang goi InventoryItemsService).

## 2) Pham vi va rang buoc bat buoc

- Giu nguyen controller hien tai:
  - src/inventory-core/inventory-core.controller.ts
- Giu nguyen facade service class va ten class de module khac khong bi anh huong:
  - src/inventory-core/inventory-core.service.ts
- Giu nguyen module va export token InventoryItemsService:
  - src/inventory-core/inventory-core.module.ts
- Khong doi schema DB, khong doi migration.
- Khong doi ten endpoint, khong doi format du lieu tra ve, khong doi chuoi thong bao tieng Viet hien co.

## 3) Kien truc dich (tuong tu erp-invoices-core)

### 3.1 Facade

- InventoryItemsService tro thanh thin facade.
- Facade chi delegate method sang subservices, giong cach ErpInvoicesCoreService dang lam.

### 3.2 Subservices de xuat

- services/inventory-items-query.service.ts
  - findAll
  - getBalances

- services/inventory-items-lifecycle.service.ts
  - create
  - findOne
  - update
  - softDeleteItem
  - getMovements
  - getItemConnections

- services/inventory-masters.service.ts
  - listUoms, createUom, updateUom, softDeleteUom
  - listItemTypes, createItemType, updateItemType, softDeleteItemType
  - listTrackingPolicies
  - listTrackingCategories, createTrackingCategory, updateTrackingCategory, softDeleteTrackingCategory
  - normalizeCode, buildMasterWhere, ensureUomActive, ensureItemTypeActive, ensureTrackingCategoryActive

- services/inventory-warehouse-voucher.service.ts
  - listWarehouseVouchers

- services/inventory-serial.service.ts
  - listSerials
  - getSerial
  - updateSerial
  - confirmDelivery
  - updateSerialLifecycle
  - getSerialLifecycleColumnOptions
  - listSerialLifecycles

- services/inventory-dashboard.service.ts
  - getDashboardStats

## 4) Mapping method 1:1 tu facade

Facade InventoryItemsService se giu day du method public hien co va delegate 1:1:

- getDashboardStats -> inventoryDashboardService.getDashboardStats
- create -> inventoryItemsLifecycleService.create
- findAll -> inventoryItemsQueryService.findAll
- getBalances -> inventoryItemsQueryService.getBalances
- listUoms -> inventoryMastersService.listUoms
- createUom -> inventoryMastersService.createUom
- updateUom -> inventoryMastersService.updateUom
- softDeleteUom -> inventoryMastersService.softDeleteUom
- listItemTypes -> inventoryMastersService.listItemTypes
- listTrackingPolicies -> inventoryMastersService.listTrackingPolicies
- listTrackingCategories -> inventoryMastersService.listTrackingCategories
- createItemType -> inventoryMastersService.createItemType
- createTrackingCategory -> inventoryMastersService.createTrackingCategory
- updateItemType -> inventoryMastersService.updateItemType
- updateTrackingCategory -> inventoryMastersService.updateTrackingCategory
- softDeleteItemType -> inventoryMastersService.softDeleteItemType
- softDeleteTrackingCategory -> inventoryMastersService.softDeleteTrackingCategory
- getMovements -> inventoryItemsLifecycleService.getMovements
- getItemConnections -> inventoryItemsLifecycleService.getItemConnections
- findOne -> inventoryItemsLifecycleService.findOne
- update -> inventoryItemsLifecycleService.update
- softDeleteItem -> inventoryItemsLifecycleService.softDeleteItem
- listWarehouseVouchers -> inventoryWarehouseVoucherService.listWarehouseVouchers
- listSerials -> inventorySerialService.listSerials
- getSerial -> inventorySerialService.getSerial
- updateSerial -> inventorySerialService.updateSerial
- confirmDelivery -> inventorySerialService.confirmDelivery
- getSerialLifecycleColumnOptions -> inventorySerialService.getSerialLifecycleColumnOptions
- listSerialLifecycles -> inventorySerialService.listSerialLifecycles
- updateSerialLifecycle -> inventorySerialService.updateSerialLifecycle

## 5) Ke hoach trien khai theo pha

### Pha A: Chuan bi va khoa contract

- Tao test baseline (characterization tests):
  - API smoke cho cac route inventory quan trong.
  - Snapshot JSON response cua cac endpoint phuc tap (serial lifecycle, dashboard, vouchers, movements).
  - Test loi va status code cho cac case NotFound/BadRequest.
- Chot bo du lieu test co tinh dai dien:
  - co item, uom, item type, serial, sales order lien quan, goods receipt, goods issue, BOM, production order.

Exit criteria:
- Baseline tests pass tren code cu.
- Co danh sach contract can giu nguyen.

### Pha B: Tao skeleton subservice + wiring module

- Tao folder src/inventory-core/services.
- Tao class subservice rong (chi constructor + method stubs).
- Dang ky providers trong module.
- Cap nhat facade constructor inject subservices.
- Tam thoi giu logic cu trong facade de dam bao build xanh.

Exit criteria:
- Build pass.
- Khong endpoint nao doi hanh vi.

### Pha C: Di chuyen logic theo tung khoi chuc nang

Thu tu uu tien de giam rui ro:
1. Masters
2. Query + Balances
3. Items lifecycle
4. Warehouse vouchers
5. Serials + lifecycles
6. Dashboard

Cho moi khoi:
- Move code nguyen khoi sang subservice, tranh "clean up" cung luc.
- Facade doi sang delegate method.
- Chay test baseline ngay sau moi khoi.

Exit criteria:
- Moi khoi xong deu pass test + lint + typecheck.

### Pha D: Don dep an toan (khong doi hanh vi)

- Chi don dep import, sap xep helper dung chung.
- Khong doi cau truc response.
- Khong doi cau SQL, ten cot alias, ten truong JSON tra ve.

Exit criteria:
- Diff chu yeu la di chuyen code va wiring.

### Pha E: Kiem thu hoi quy va rollout

- Chay full test/lint/typecheck.
- Chay manual regression checklist cac API chinh.
- Neu co môi truong staging:
  - So sanh response truoc/sau voi cung bo query cho nhom endpoint critical.

Exit criteria:
- Tat ca test pass.
- Khong co sai lech contract.

## 6) Kiem soat rui ro quan trong

- Rui ro 1: thay doi text message tieng Viet trong response.
  - Giai phap: copy nguyen van message cu, them assertion string trong tests.

- Rui ro 2: thay doi thu tu sort/default filter o SQL.
  - Giai phap: giu nguyen query string va order by, snapshot output.

- Rui ro 3: thay doi transaction behavior trong confirmDelivery.
  - Giai phap: giu nguyen dataSource.transaction boundary va thu tu update.

- Rui ro 4: thay doi dependency injection token gay anh huong dashboard-core.
  - Giai phap: giu nguyen class InventoryItemsService va export nhu cu.

- Rui ro 5: bien private helper bi mat khi tach service.
  - Giai phap: gom helper vao inventory-masters.service hoac file helper dung chung va import ro rang.

## 7) Danh sach kiem tra "khong doi hanh vi"

- Route va method HTTP khong doi.
- Guard/permission decorator khong doi.
- DTO input khong doi.
- Response keys khong doi (camelCase va nested object).
- Message text khong doi.
- Status code khong doi.
- Sorting/filtering/pagination khong doi.
- SQL alias va du lieu tong hop dashboard khong doi.
- DashboardCoreService van inject va goi InventoryItemsService binh thuong.

## 8) Thu tu commit de review de dang

- Commit 1: skeleton services + module wiring + facade inject (chua move logic)
- Commit 2: move masters
- Commit 3: move query/items lifecycle
- Commit 4: move vouchers + serials/lifecycle
- Commit 5: move dashboard + cleanup imports
- Commit 6: tests va snapshot update (neu can)

## 9) Tieu chi hoan thanh

- inventory-core.service.ts chi con facade methods delegate.
- Logic nam o cac subservice theo dung domain.
- Khong thay doi API contract va hanh vi runtime.
- Typecheck, lint, tests deu pass.

## 10) Work Breakdown chi tiet (bat buoc lam theo task nho)

Nguyen tac:
- Khong move logic khi chua co baseline test cho khoi do.
- Moi task nho phai co output ro rang va pass check ngay tai cho.
- Neu task nao fail regression thi rollback task do (khong merge task tiep theo).

### Nhom T0 - Baseline va safety net

- T0.1 Lap danh sach endpoint va contract can freeze.
  - Output: bang endpoint + method + response keys + message text.
- T0.2 Tao bo du lieu test dai dien cho inventory flow.
  - Output: seed/test fixture cho item, balance, serial, SO, GR, GI, BOM, PO.
- T0.3 Characterization tests cho endpoint inventory quan trong.
  - Output: test pass tren code truoc refactor, snapshot duoc khoa.

### Nhom T1 - Skeleton architecture

- T1.1 Tao folder services va class skeleton.
- T1.2 Wiring providers vao module.
- T1.3 Inject subservices vao facade, chua thay doi logic.
- T1.4 Verify build/typecheck.

### Nhom T2 - Masters block

- T2.1 Move UOM CRUD + soft delete.
- T2.2 Move ItemType CRUD + soft delete.
- T2.3 Move TrackingCategory CRUD + soft delete.
- T2.4 Move listTrackingPolicies + helpers dung chung.
- T2.5 Regression test masters.

### Nhom T3 - Query + Item lifecycle block

- T3.1 Move findAll/getBalances.
- T3.2 Move create/findOne/update/softDeleteItem.
- T3.3 Move getMovements.
- T3.4 Move getItemConnections.
- T3.5 Regression test query + lifecycle.

### Nhom T4 - Warehouse voucher block

- T4.1 Move listWarehouseVouchers nguyen van SQL.
- T4.2 Snapshot ket qua union/filter/sort.

### Nhom T5 - Serial + lifecycle block

- T5.1 Move listSerials/getSerial/updateSerial.
- T5.2 Move confirmDelivery (giu transaction boundary).
- T5.3 Move updateSerialLifecycle/getSerialLifecycleColumnOptions/listSerialLifecycles.
- T5.4 Regression test serial/lifecycle.

### Nhom T6 - Dashboard block

- T6.1 Move getDashboardStats.
- T6.2 Snapshot aggregate fields + trend.

### Nhom T7 - Final regression va rollout

- T7.1 Full test/lint/typecheck.
- T7.2 Chay manual checklist critical flow.
- T7.3 So sanh truoc/sau tren staging voi cung query.

## 11) Test strategy dac biet cho logic nhap/xuat va reserve kho

Muc tieu:
- Dam bao refactor inventory-core khong gay regression cho luong nhap/xuat va reserve du logic nam o module lien quan.
- Xac minh tinh nhat quan giua qtyOnHand, qtyReserved, availableQty va inventory transactions.

Pham vi lien thong bat buoc cover:
- inventory-core (doc/aggregate/display): getBalances, getMovements, warehouse vouchers, dashboard.
- goods-receipts-core (nhap kho): tang qtyOnHand, tao transaction RECEIPT.
- goods-issues-core (xuat kho): giam qtyOnHand, consume/reverse reserved, tao transaction ISSUE.
- sales-orders-core (reserve/unreserve): tang/giam qtyReserved, cap nhat serial status RESERVED.

### 11.1 Matrix test nhap kho (Goods Receipt)

- Case GR-01: Post phieu nhap binh thuong.
  - Expect: qtyOnHand tang dung so luong, qtyReserved khong doi.
  - Expect: transaction RECEIPT duoc tao, getMovements co dong documentType GOODS_RECEIPT.
- Case GR-02: Cancel/revert phieu nhap da post.
  - Expect: qtyOnHand giam nguoc lai dung so luong.
  - Expect: du lieu inventory-core getBalances/getDashboardStats cap nhat dung.
- Case GR-03: Nhap item moi chua co balance.
  - Expect: tao balance record dung default va so lieu.

### 11.2 Matrix test xuat kho (Goods Issue)

- Case GI-01: Post phieu xuat khi du ton kha dung.
  - Expect: qtyOnHand giam dung so luong, availableQty cap nhat dung.
  - Expect: transaction ISSUE duoc tao, getMovements co documentType GOODS_ISSUE.
- Case GI-02: Xuat co lien ket reserve tren SO line.
  - Expect: qtyReserved giam dung reservedConsume, qtyOnHand giam dung qty xuat.
  - Expect: so line qtyReserved va SO status duoc cap nhat dung.
- Case GI-03: Xuat khong lien ket SO nhung co reserved balance.
  - Expect: xu ly reservedConsume theo logic hien tai, khong am qtyReserved.
- Case GI-04: Reverse/cancel phieu xuat da post.
  - Expect: qtyOnHand tang lai; qtyReserved duoc restore dung theo current behavior.

### 11.3 Matrix test reserve/unreserve (Sales Order)

- Case RS-01: Reserve full khi available du.
  - Expect: balance.qtyReserved tang, line.qtyReserved tang, SO status RESERVED.
- Case RS-02: Reserve partial khi available khong du.
  - Expect: line.qtyReserved tang den muc co the, SO status PARTIAL_RESERVED.
- Case RS-03: Reserve item co serial tracking.
  - Expect: serial status chuyen RESERVED va gan salesOrderLineId.
- Case UR-01: Unreserve full.
  - Expect: balance.qtyReserved giam ve 0 tuong ung, line.qtyReserved ve 0.
- Case UR-02: Unreserve partial/loop qua nhieu balance.
  - Expect: phan bo giam reserved dung thu tu hien tai, khong am so.

### 11.4 Invariants bat buoc assert trong test

- Invariant I1: availableQty = qtyOnHand - qtyReserved (tai response getBalances).
- Invariant I2: qtyReserved khong am trong moi flow.
- Invariant I3: Tong bien dong getMovements phu hop voi balance cuoi ky theo item.
- Invariant I4: Cancel/reverse operation dua balance ve dung state truoc operation.
- Invariant I5: Khong doi message text/status code so voi baseline.

### 11.5 Test cap do va thu tu chay

- Cap 1: Unit/service-level test cho ham tinh toan qty (reserve/unreserve/consume).
- Cap 2: Module integration test cho goods-receipts, goods-issues, sales-orders, inventory-core.
- Cap 3: API characterization test cho endpoint inventory critical.
- Cap 4: End-to-end scenario test:
  - Tao SO -> reserve -> tao GI -> post GI -> kiem tra balances/movements/dashboard -> cancel GI -> unreserve.

Thu tu chay moi dot move logic:
1. Chay tests khoi vua move.
2. Chay bo cross-module stock-reserve tests.
3. Chay full suite inventory + goods-issues + goods-receipts + sales-orders.

## 12) Gate quality truoc khi merge

- Gate G1: Khong co regression tren test matrix muc 11.
- Gate G2: So sanh snapshot response truoc/sau trung khop cho endpoint da khoa contract.
- Gate G3: Typecheck/lint xanh.
- Gate G4: Co bang doi soat truoc/sau cho 5 scenario kho quan trong:
  - Nhap kho.
  - Xuat kho.
  - Reserve.
  - Unreserve.
  - Xuat lien ket reserve + reverse.
