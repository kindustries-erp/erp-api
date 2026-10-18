---
name: garage-cashflow
description: Module tri thức Quản lý Thu Chi Xưởng (Garage Cashflow) trong erp-api (kgara-api-core). Chứa toàn bộ database schema (kgara_cashflow_vouchers), DTOs, API endpoints, logic tạo phiếu cấn trừ tự động (kgara_case_settlements), và dashboard thống kê thu chi độc lập với cashflow chung của ERP.
---

# 📦 Module Tri Thức: Garage Cashflow (Thu chi xưởng) - Backend (`erp-api`)

## 1. Tổng quan Nghiệp vụ
Module **Garage Cashflow** quản lý luồng tiền thu/chi đặc thù của xưởng (Garage). Tính năng này được thiết kế ĐỘC LẬP hoàn toàn với Cashflow chung của ERP (`erp_cash_vouchers`, `erp_bank_transactions`), nhưng cung cấp khả năng tham chiếu/liên kết đến các phiếu ngân hàng hoặc sổ quỹ của ERP.
- Đóng vai trò là sổ quỹ trung tâm của Garage.
- Khi tạo thu/chi có gắn với Phiếu dịch vụ (`case_id`), hệ thống tự động sinh và cập nhật các dòng cấn trừ vào bảng `kgara_case_settlements` để đối soát và tính công nợ.

## 2. Database Schema & Quan hệ Dữ liệu
**Bảng chính**: `kgara_cashflow_vouchers`
- `id` (uuid, PK)
- `voucher_code` (varchar 50, UNIQUE) - VD: `PT-GARA-YYMMDD-XXX`, `PC-GARA-YYMMDD-XXX`
- `voucher_type` (varchar 20) - `RECEIPT` hoặc `PAYMENT`
- `amount` (numeric 18,2, default 0) - Số tiền
- `trans_date` (date) - Ngày giao dịch
- `case_id` (uuid, FK -> `kgara_cases`, nullable) - Tham chiếu Phiếu dịch vụ liên quan
- `license_plate` (varchar 50, nullable) - Biển số xe gắn với phiếu (auto sync từ `kgara_cases.bien_so_xe` hoặc nhập tay)
- `payment_method` (varchar 50, nullable) - Phương thức thanh toán thuần túy (Tiền mặt, Chuyển khoản, Thẻ tín dụng, Khác)
- `payment_content` (varchar 100, nullable) - Nội dung thanh toán / mục đích thu chi. Chuẩn hóa 12 options có số thứ tự từ 1 đến 12:
  1. `1. KH thanh toán`
  2. `2. Tất toán`
  3. `3. BH thanh toán`
  4. `4. HHBH`
  5. `5. Ứng trước`
  6. `6. Cấn trừ`
  7. `7. Phụ tùng / vật tư` (bỏ chữ "Mua")
  8. `8. Vật tư tiêu hao` (option mới)
  9. `9. Chi phí vận hành`
  10. `10. Hoa hồng / nhân công`
  11. `11. Hoàn ứng`
  12. `12. Khác`
  *(Đã chạy migration `20261016140000-UpdateKgaraCashflowVoucherPaymentContentClassification` cập nhật toàn bộ chứng từ lịch sử trong DB `erp_greenway_production`).*
- `payment_status` (varchar 30, nullable) - Trạng thái thanh toán của phiếu thu (RECEIPT) và phiếu chi (PAYMENT):
  - **Phiếu chi (PAYMENT)**:
    - `PENDING`: "Chờ duyệt" (mặc định khi tạo mới phiếu chi)
    - `APPROVED`: "Đã duyệt"
    - `PAID`: "Đã chi" (chỉ khi Đã chi mới tạo settlement trừ công nợ nếu không thuộc nhóm 4/8)
  - **Phiếu thu (RECEIPT)**:
    - `EXPECTED`: "Dự thu" (tiền chưa vào quỹ/tài khoản, **KHÔNG** tạo bản ghi cấn trừ `kgara_case_settlements` và không trừ công nợ của Case)
    - `PAID` (hoặc `NULL` trong dữ liệu lịch sử): "Đã thu" (tiền đã thực thu, tự động tạo `kgara_case_settlements` và tính trừ công nợ của Case)
- `partner_name` (varchar 255, nullable) - Tên đối tác (auto sync từ case hoặc nhập tay)
- `erp_bank_transaction_id` (uuid, FK -> `erp_bank_transactions`, nullable) - Tham chiếu sao kê ngân hàng ERP
- `erp_cash_voucher_id` (uuid, nullable) - Tham chiếu phiếu thu/chi sổ quỹ ERP
- `note` (text, nullable)
- `created_by` (varchar 255, nullable) - Lưu email/user id của người tạo phiếu (lấy động 100% từ `req.user.email` của phiên đăng nhập)
- `created_at` (timestamptz), `updated_at` (timestamptz)

**Ràng buộc & Index**:
- Khóa ngoại liên kết tới `kgara_cases.id` và `erp_bank_transactions.id` với `ON DELETE SET NULL`.
- Các chỉ mục: `IDX_gara_cashflow_code`, `IDX_gara_cashflow_case`, `IDX_gara_cashflow_trans_date`, `IDX_gara_cashflow_license_plate`, `IDX_gara_cashflow_payment_method`, `IDX_gara_cashflow_payment_content`, `IDX_gara_cashflow_payment_status`.

**Sự thay đổi ở** `kgara_case_settlements`:
- Được thêm trường `cashflow_voucher_id` (uuid, FK -> `kgara_cashflow_vouchers.id`, `ON DELETE SET NULL`) để mapping tự động từ phiếu thu/chi sang phiếu cấn trừ.

## 3. Cấu trúc Source Code Backend
Thuộc phân hệ `kgara-api-core`:
```text
src/kgara-api-core/
├── entities/
│   ├── kgara_cashflow_voucher.entity.ts
│   └── kgara_case_settlement.entity.ts (cập nhật mapping cashflow_voucher_id)
├── dto/
│   └── garage-cashflow.dto.ts (Create, Update, List Query, Dashboard DTOs, KgaraCashflowVoucherResponseDto & toKgaraCashflowVoucherResponse)
├── controllers/
│   └── garage-cashflow.controller.ts (Base path: /api/v1/greenway/cashflow-vouchers, Return Zero-Entity Leaking DTO)
└── services/
    ├── garage-cashflow.service.ts (Facade Service Pattern, Clean DI Constructor)
    ├── garage-cashflow-transaction.service.ts (Sub-Service quản lý tạo, sửa, xóa, cấn trừ, transaction lock)
    └── engines/
        ├── garage-cashflow-query.engine.ts (Sub-Service query, get list, selective column projection, options, filter)
        └── garage-cashflow-dashboard.engine.ts (Sub-Service tính toán KPI, method/content breakdowns, trend 6 tháng & top 5 txns)
```

## 4. Danh sách API Endpoints & RBAC Contract

**Controller**: `GarageCashflowController`
**Base Route**: `/api/v1/greenway/cashflow-vouchers`
**Yêu cầu quyền**: Resource `GARAGE_CASHFLOW` (`garage_cashflow`) (thuộc hệ thống Role-Based Access Control, tách riêng độc lập khỏi `GARAGE`).

| HTTP Method | Endpoint | Quyền (Action) | Mô tả |
|-------------|----------|----------------|-------|
| `GET` | `/` | `READ` | Lấy danh sách phiếu thu/chi xưởng (phân trang, filter theo date, type, case_id). Trả về `PaginatedResult<KgaraCashflowVoucherResponseDto>` (Zero-Entity Leaking). |
| `GET` | `/column-options` | `READ` | Lấy danh sách giá trị option phân trang cho bộ lọc cột (dynamic column filters). |
| `GET` | `/dashboard` | `READ` | Thống kê KPI (tổng thu, chi, net, số phiếu), breakdown theo phương thức và nội dung thanh toán, xu hướng 6 tháng gần nhất và Top 5 giao dịch thu/chi lớn nhất. Nhận `GarageCashflowDashboardQueryDto` (`dateFrom`, `dateTo`, `branchId`, `paymentMethod`, `paymentStatus`), trả về `GarageCashflowDashboardResponseDto` (Zero-Entity Leaking). |
| `POST` | `/` | `CREATE` | Tạo phiếu mới. Nếu có `case_id`, tự động tạo record cấn trừ trong `kgara_case_settlements`. Trả về `KgaraCashflowVoucherResponseDto`. |
| `PUT` | `/:id` | `UPDATE` | Cập nhật phiếu thu/chi. Tự động đồng bộ sang record cấn trừ tương ứng. Trả về `KgaraCashflowVoucherResponseDto`. |
| `DELETE` | `/:id` | `DELETE` | Xóa phiếu thu/chi, đồng thời xóa record cấn trừ liên kết. |

## 5. Logic Nghiệp vụ & Kiến trúc Chuẩn Hóa (/api-service-refactor)
- **Zero-Entity Leaking Mandate (Pattern D)**:
  - 100% Endpoints của `GarageCashflowController` không trả trực tiếp TypeORM Entity `KgaraCashflowVoucher` ra ngoài.
  - Sử dụng hàm chuẩn hóa `toKgaraCashflowVoucherResponse(voucher: KgaraCashflowVoucher): KgaraCashflowVoucherResponseDto` để map dữ liệu an toàn.
  - Quan hệ `case` và `erpBankTransaction` được bóc tách sang `KgaraCashflowCaseResponseDto` và `KgaraCashflowBankTransactionResponseDto`, triệt tiêu hoàn toàn rò rỉ các trường nhạy cảm hoặc cấu trúc entity nội bộ.
- **Query Engine Selective Projection (Pattern C)**:
  - Trong `GarageCashflowQueryEngine.listVouchers`, tuyệt đối KHÔNG sử dụng `leftJoinAndSelect('voucher.case', 'case')` vì `KgaraCase` chứa cột `raw_data` JSONB rất lớn (>100KB-500KB từ danh sách vật tư/công dịch vụ).
  - Sử dụng `leftJoin` kết hợp `addSelect` chỉ chiếu đúng 5 trường cần thiết: `case.id`, `case.soChungTu`, `case.bienSoXe`, `case.khachHangName`, `case.khachHangCode`.
  - Giúp tối ưu hóa tốc độ truy vấn database, tiết kiệm băng thông và giảm 99% kích thước bộ nhớ trả về.
- **Express Body Parser & Exception Handling (10MB & HTTP 413)**:
  - Cấu hình tại `erp-api/src/main.ts` nâng giới hạn `bodyParser` lên 10MB: `json({ limit: '10mb' })` và `urlencoded({ limit: '10mb', extended: true })`.
  - `AllExceptionsFilter` (`src/common/filters/all-exceptions.filter.ts`) tự động bắt lỗi `PayloadTooLargeError` hoặc HTTP status 413 từ Express/Body-Parser để trả về mã chuẩn HTTP 413 Payload Too Large thay vì rơi vào 500 Internal Server Error.
- **Transaction Safety & Audit Trail (`/api-service-refactor`)**:
  - Toàn bộ thao tác Create, Update, Delete đều sử dụng `queryRunner.startTransaction()` để đảm bảo tính nhất quán (ACID) giữa bảng `kgara_cashflow_vouchers` và `kgara_case_settlements`.
  - Tích hợp `AuditCoreService` với Clean DI constructor (`@Optional() private readonly auditCoreService?: AuditCoreService`).
  - Tự động ghi nhận `recordAction` vào `erp_audit_logs` khi tạo mới (`actionType: 'CREATE'`), cập nhật (`actionType: 'UPDATE'` kèm `beforeSnapshot` và `afterSnapshot`), và xóa (`actionType: 'DELETE'`).
  - **Dynamic User Context Extraction**: Controller trích xuất `@Req() req: any`, truyền `req?.user` (`{ sub, email }`) xuống Service. Khi tạo phiếu, gán `newVoucher.createdBy = user?.email || user?.sub`. Khi ghi audit log, truyền tường minh `actorUserId: user?.sub`, `actorEmail: user?.email`.
  - Phía Web (`GarageCashflowDrawer`) tự động lấy nhật ký kiểm toán từ API `/api/v1/audit-logs-core/garage_cashflow_voucher/:id/timeline` và kết hợp với baseline metadata qua `mergeAuditItems` để hiển thị trong Tab **"Lịch sử & Kiểm duyệt"** (`DrawerAuditTimeline`).
  - **Timeline Smart Actor Rendering**: `DrawerAuditTimeline` hiển thị ưu tiên `actorEmail` (hoặc `{actorName} ({actorEmail})` nếu có tên riêng), fallback thông minh sang `currentUserEmail` từ `useAuthStore` cho các phiếu cũ chưa có `createdBy`.
- **Auto-Sync Settlements**:
  - Khi **tạo** Voucher có `caseId`, hệ thống tự sinh `KgaraCaseSettlement` với `sourceChannel = 'ON_SYSTEM'`, `paymentMethod = 'CASH'`, `payerType = 'KH'`. **Phiếu chi** chỉ sinh settlement khi `payment_status = 'PAID'` và `payment_content` không phải `4. HHBH` / `8. Vật tư tiêu hao` (xem mục "Quy tắc phiếu chi" cuối file).
  - Khi **cập nhật** Voucher (thay đổi `amount`, `date`, `caseId`), hệ thống dò tìm `KgaraCaseSettlement` qua `cashflowVoucherId` để cập nhật đồng bộ, hoặc xóa đi (nếu `caseId` bị gỡ), hoặc tạo mới (nếu `caseId` mới được thêm vào).
  - Khi **xóa** Voucher, hệ thống tự động kiểm tra và xóa `KgaraCaseSettlement` tương ứng nếu có.
- **Mã tự động**: `voucherCode` nếu client không truyền lên sẽ tự sinh theo format: `PT-GARA-YYMMDD-XXX` hoặc `PC-GARA-YYMMDD-XXX`.
- **Sorting & Filtering Động**: Hỗ trợ sort nhiều field (parse từ `sorts` query param CSV).
  - ⚠️ **Lưu ý sống còn về TypeORM QueryBuilder Sorting**: Khi sử dụng phân trang `skip/take` hoặc `getManyAndCount()`, TypeORM gọi hàm nội bộ `createOrderByCombinedWithSelectExpression` và dùng `alias.metadata.findColumnWithPropertyPath(propertyPath)` để map cột. Do đó, các trường truyền vào `orderBy()` và `addOrderBy()` **BẮT BUỘC phải là Entity Property Path (camelCase)**: `voucher.transDate`, `voucher.createdAt`, `voucher.voucherCode`, `voucher.amount`, `voucher.partnerName`, `voucher.licensePlate`, `case.soChungTu`. Tuyệt đối KHÔNG truyền trực tiếp tên cột DB dạng snake_case (`voucher.trans_date`), vì sẽ gây crash runtime: `TypeError: Cannot read properties of undefined (reading 'databaseName')`.
  - **Thứ tự sắp xếp mặc định**: `voucher.transDate DESC, voucher.createdAt DESC, voucher.voucherCode DESC` (ưu tiên ngày chứng từ mới nhất lên đầu; nếu trùng ngày thì xếp theo thời điểm tạo mới nhất; tie-breaker theo mã phiếu để đảm bảo phân trang ổn định). Phía web khởi tạo state `sorts = ['-transDate']`.
  - Đối với bộ lọc `applyMultiKeywordFilter` và `getColumnOptions`: tiếp tục dùng raw SQL với snake_case (`case.khach_hang_name`, `case.bien_so_xe`, `case.so_chung_tu`).

## 6. Tích hợp Liên Module
- **erp-bank-transactions**: Lưu tham chiếu qua trường `erpBankTransactionId` (không ràng buộc cứng business logic, chỉ dùng cho tra cứu chéo/đối soát). Khi get list hoặc view detail, queryBuilder `leftJoin` chọn lọc `id`, `transactionCode`, `transDate`, `amount`.
- **erp-cash-vouchers**: Lưu tham chiếu qua trường `erpCashVoucherId`.
- **kgara-cases**: Lấy thông tin khách hàng (`khachHangName`) từ `KgaraCase` để gán `partnerName` vào phiếu cấn trừ `KgaraCaseSettlement`. Hiển thị `soChungTu` qua selective join.

## 7. Cấu trúc Source Code Frontend (Web)
Tuân thủ nghiêm ngặt **Atomic UI** (Folder-per-Component, < 180 LoC/file, co-located tests, No Blue Mandate) theo `/ui-atomic-refactor`:
```text
src/modules/garage/components/
├── molecules/
│   ├── payment-method-combobox/     (Molecule dropdown chọn phương thức TT thuần túy: Tiền mặt, Chuyển khoản, Thẻ tín dụng, Khác, < 40 LoC)
│   ├── payment-content-combobox/    (Molecule dropdown chọn nội dung TT: 12 options có số thứ tự, < 40 LoC)
│   └── cashflow-amount-input/       (Molecule input số tiền: format phân cách hàng nghìn vi-VN, đọc số bằng chữ qua readVietnameseCurrency, 100% i18n, < 90 LoC)
└── organisms/
    ├── garage-cashflow-table/       (Organism Data Table chuẩn, < 180 LoC/file)
    │   ├── index.ts
    │   ├── GarageCashflowTable.tsx  (Main component, < 100 LoC)
    │   ├── GarageCashflowTable.columns.tsx (Cấu hình các cột gồm Cột Phương thức TT, Nội dung TT & Cột Trạng thái (phiếu chi), < 180 LoC)
    │   ├── GarageCashflowTable.actions.tsx (Bóc tách Action Column riêng biệt, < 50 LoC)
    │   ├── GarageCashflowTable.paymentCells.tsx (Renderers badge Phương thức TT, 12 Nội dung TT & Trạng thái thanh toán Chờ duyệt/Đã duyệt/Đã chi, < 120 LoC)
    │   ├── GarageCashflowTable.helper.tsx (Renderers chung & Date range header, < 160 LoC)
    │   ├── GarageCashflowTable.hook.ts (Fetch dữ liệu, filters, sorts, < 180 LoC)
    │   ├── GarageCashflowTable.type.ts (Option constants cho Method & Content)
    │   └── GarageCashflowTable.test.tsx (Co-located Unit Test)
    ├── garage-cashflow-drawer/      (Organism Drawer chuẩn Atomic & Top Tabs < 180 LoC)
    │   ├── index.ts
    │   ├── GarageCashflowDrawer.tsx (Khung StandardFormDrawer với Top Navigation Tabs: "Chi tiết" & "Lịch sử & Kiểm duyệt", < 180 LoC)
    │   ├── GarageCashflowDrawer.hook.ts (Form state, validation, mutations, remote audit timeline, < 180 LoC)
    │   ├── GarageCashflowDrawer.state.ts (Initial state, DTO payloads, computeAuditDiffs, < 140 LoC)
    │   ├── GarageCashflowDrawer.helper.ts (Baseline audit items, duplicate check helpers, < 160 LoC)
    │   ├── GarageCashflowDrawer.type.ts (< 30 LoC)
    │   ├── GarageCashflowDrawerGeneralSection.tsx (Grid 2 cột: Tích hợp CashflowAmountInput, PaymentContentCombobox, 100% i18n, < 150 LoC)
    │   ├── GarageCashflowDrawerViewSection.tsx (Sub-section View Mode bóc tách < 70 LoC)
    │   ├── GarageCashflowDrawerSettlementSection.tsx (< 90 LoC)
    │   └── GarageCashflowDrawer.test.tsx (Co-located Unit Test bao phủ Tabs & Timeline)
    └── garage-cashflow-list/
        ├── GarageCashflowList.tsx   (Wrapper kết nối Table và Drawer)
        └── GarageCashflowList.test.tsx (Co-located Unit Test)
```
- **Cấu trúc Điều hướng & Tích hợp Trang (`/garage-debts` & Sidebar)**:
  - **Tích hợp Tab Thu Chi Xưởng vào Công nợ Garage (`GarageDebts`)**: Danh sách thu chi xưởng (`GarageCashflowList`) được tích hợp làm tab thứ 4 (tab cuối cùng: `Tổng quan` ➔ `Phải thu` ➔ `Phải trả` ➔ `Thu chi xưởng`) trong trang Công nợ Garage (`GarageDebts` - route `/garage-debts`).
  - **Tối Ưu Hóa & Làm Sạch Form State Drawer (`GarageCashflowDrawer.hook.ts`)**:
    - Khi mở drawer chỉnh sửa, form state được khởi tạo tường minh từng trường (không dùng `...voucher` spread) để ngăn chặn việc ngậm đối tượng `case` và các thuộc tính JSONB phức tạp.
    - Trước khi gửi request `PUT /:id` hoặc `POST /`, payload được sanitize sạch sẽ, chỉ giữ lại đúng các trường hợp lệ của `UpdateGarageCashflowVoucherDto` / `CreateGarageCashflowVoucherDto` (loại bỏ `case`, `rawData`, `erpBankTransaction`, `createdAt`, v.v.), giảm kích thước request từ >100KB xuống dưới 500 bytes.
  - **Secondary Drawer Icon cho Cột Mã PDV (`caseCode`)**:
    - Trong bảng `GarageCashflowTable`, tại cột **Mã PDV**, thành phần `TableText` được kích hoạt thuộc tính `onDrawerClick` (icon `PanelRightOpen`, tooltip `"Xem chi tiết phiếu dịch vụ"`).
    - Callback `onOpenCaseDetail` được truyền từ `GarageCashflowList` xuống bảng `GarageCashflowTable` và hàm helper `renderCaseCodeCell`.
    - Khi người dùng click icon Drawer trên dòng bất kỳ có liên kết Mã PDV, hệ thống tự động mở Drawer chi tiết phiếu dịch vụ (`GarageCaseStandaloneDrawer`) ngay tại trang mà không cần điều hướng.
  - **Tab Visibility RBAC**: Tab "Thu chi xưởng" chỉ hiển thị khi người dùng có quyền `GARAGE_CASHFLOW:READ`. Truy cập trực tiếp qua URL `?tab=cashflow` khi thiếu quyền sẽ tự động fallback an toàn về tab `overview`.
  - **Phân quyền Context Menu Xóa & Action Menu**: Chỉ người dùng có quyền `GARAGE_CASHFLOW:DELETE` (`canDelete === true` và `onDelete` được truyền vào) mới thấy mục "Xóa phiếu" trong chuột phải và nút ba chấm (`...`). Người không có quyền DELETE bị ẩn hoàn toàn 100% mục xóa (không render DOM item).
  - **Dọn dẹp Dead Code**: Trang tổng quan `GarageCashflowDashboard` và file `GarageCashflowPage.tsx` đã được xóa bỏ hoàn toàn. Route alias `"garage-cashflow"` trong `App.tsx` tự động chuyển tiếp sang `() => <GaragePartners initialTab="cashflow" />`.
  - **Chuẩn Hóa Column Filter & Query Engine (`GarageCashflowQueryEngine`)**:
    - Hỗ trợ lọc ngày độc lập `transDate` (`from..to`) và `createdAt`.
    - Hỗ trợ lọc tiền vào (`thu`: `voucher_type = 'RECEIPT'`) và tiền ra (`chi`: `voucher_type = 'PAYMENT'`) theo khoảng tiền `min..max` hoặc danh sách số tiền chính xác.
    - Hỗ trợ lọc rỗng `__BLANK__` cho các trường nullable (`caseCode`, `licensePlate`, `note`).
    - Phía client: cột `paymentMethod` sử dụng Client Select Filter (`filterOptions`).
  - **Sidebar GARAGE Phẳng Hóa**: Section GARAGE trên Sidebar đã được phẳng hóa thành 3 mục trực tiếp (không còn popup submenu trung gian):
    - **Mục 1**: `Phiếu dịch vụ` (`garage-cases` | Icon: `FileSpreadsheet`)
    - **Mục 2**: `Công nợ garage` (`garage-debts` | Icon: `Users`)
    - **Mục 3**: `Chi phí vận hành Garage` (`garage-opex` | Icon: `ReceiptText`)
  - **Command Palette Search**: Item `garage-cashflow` độc lập đã được gỡ bỏ; các từ khóa "thu chi xưởng", "dòng tiền xưởng", "sổ quỹ", "garage cashflow" được tích hợp trực tiếp vào mục `garage-debts`.
  - **Chuẩn Hóa Sắp Xếp (Sorting Architecture) & Chuẩn /standardize-table (`sorts` & `sorts[]`)**:
    - **Server-Side Tự Động Sort Mặc Định**: Khi client không truyền tham số sort (vừa vào tab Thu chi xưởng), `GarageCashflowQueryEngine` luôn tự động áp dụng `voucher.transDate DESC, voucher.createdAt DESC, voucher.voucherCode DESC`. Dữ liệu trả về luôn sắp xếp theo ngày giao dịch mới nhất mà không cần client phải chủ động bấm sort.
    - **TypeORM Entity Property Paths**: Toàn bộ biểu thức `orderBy` và `addOrderBy` trong `GarageCashflowQueryEngine` bắt buộc sử dụng camelCase Property Path của Entity (`voucher.transDate`, `voucher.createdAt`, `voucher.voucherCode`, `voucher.amount`, `case.soChungTu`, v.v.), tránh dùng snake_case cột DB để không kích hoạt lỗi TypeORM `databaseName` khi gọi `getManyAndCount()`.
    - **Client-Side Chuẩn `/standardize-table`**:
      - `GarageCashflowTable.hook` và `useGarageCashflowList` khởi tạo `sorts: []` (mặc định rỗng, tuyệt đối không hardcode client sort state).
      - Khi `sorts.length === 0`, client truyền `sorts: undefined` (Axios không gửi param `sorts` lên URL).
      - `GarageCashflowTable.hook` cung cấp `toggleSort(key)` chuẩn 3 chu kỳ (`none -> asc -> desc -> none`) và kết nối trực tiếp vào `onSort` của `SpreadsheetPageTemplate`/`DataTable`.
    - **Hỗ Trợ Đa Dạng Client (`sorts` và `sorts[]`)**:
      - `ListKgaraCashflowVoucherQueryDto` khai báo cả `@IsOptional() sorts?: string | string[];` và `@IsOptional() 'sorts[]'?: string | string[];` để vượt qua NestJS `ValidationPipe` ({ `whitelist: true`, `forbidNonWhitelisted: true` }).
      - `GarageCashflowQueryEngine` đọc `rawSorts = query.sorts || query['sorts[]']`, hỗ trợ parse an toàn cả mảng (`['-transDate']`), chuỗi đơn (`'-transDate'`), hoặc chuỗi nhiều trường phân tách bằng dấu phẩy (`'-transDate,createdAt'`).

## 8. Quy tắc Kiểm thử & Báo cáo Chất lượng
Khi có thay đổi logic trong module này, bắt buộc phải:
1. Kiểm tra typing API: `bun run type:check` (trong thư mục API)
2. Chạy CI local: `bun run check:ci` (trong thư mục API)
3. Chạy unit tests Controller, Facade Service & Exception Filter API:
   - `bunx jest src/kgara-api-core/controllers/garage-cashflow.controller.spec.ts`
   - `bunx jest src/kgara-api-core/services/garage-cashflow.service.spec.ts`
   - `bunx jest src/common/filters/all-exceptions.filter.spec.ts`
4. Kiểm tra typing Web: `bunx tsc --noEmit` (trong thư mục Web)
5. Chạy unit tests Web:
   - `bunx vitest run src/modules/garage/pages/__tests__/GarageCashflowPage.test.tsx`
   - `bunx vitest run src/modules/garage/components/organisms/garage-cashflow-table/GarageCashflowTable.test.tsx`
   - `bunx vitest run src/modules/garage/components/organisms/garage-cashflow-drawer/GarageCashflowDrawer.test.tsx`
   - `bunx vitest run src/modules/garage/components/organisms/garage-cashflow-list/GarageCashflowList.test.tsx`

## Frontend Architecture & Routing (`/garage-cashflow`)
- Trang **Thu chi garage** (`GarageCashflowPage`) là một trang độc lập (`/garage-cashflow`), được bảo vệ bằng RBAC `useHasPermission(ErpResource.GARAGE_CASHFLOW, ErpAction.READ)` (nếu không có quyền sẽ hiển thị `<Forbidden />`).
- Trong thanh menu điều hướng (Sidebar Nav & `useNavItems`), menu **"Thu chi garage"** (icon `Wallet`) được đặt **nằm phía trên "Phiếu dịch vụ"** (`garage-cases`).
- Tab "Thu chi xưởng" trong `GarageDebts` (`/garage-debts`) đã được gỡ bỏ hoàn toàn; `GarageDebts` chỉ còn 3 tab: `Tổng quan`, `Phải thu`, `Phải trả`.

## Liên kết với Công nợ Garage (`garage-debts`)
- Dòng `kgara_case_settlements.settlement_type = 'PAYMENT'` (sinh từ phiếu chi/cấn trừ phải trả) là nguồn "Đã chi" của tab Tổng quan và tab Phải trả ở `/garage-debts` (xem `garage-customers/SKILL.md` mục 8.1-8.2). Chỉ `RECEIPT` được cộng vào `kgara_cases.tien_da_thanh_toan`. `payer_type` của PAYMENT hiện đều là `KH`, không dùng để lọc.

## Cảnh báo phiếu trùng khi tạo/sửa phiếu thu chi (duplicate-check)
- **API**: `GET /api/v1/greenway/cashflow-vouchers/duplicate-check?amount=&transDate=&caseId=&licensePlate=&excludeId=`, quyền `GARAGE_CASHFLOW:CREATE` **hoặc** `UPDATE` (`@RequireAnyPermissions`). Chỉ đọc, không ghi DB, không migration.
- **Engine**: `services/engines/garage-cashflow-duplicate.engine.ts` (`GarageCashflowDuplicateEngine`), facade `GarageCashflowService.findPotentialDuplicates`. Provider khai báo trong `kgara-api-core.module.ts`.
- **Quy tắc** (số tiền phải bằng đúng, không phân biệt Thu/Chi):
  - `nearbyDate`: `trans_date` lệch ≤ 7 ngày so với ngày nhập.
  - `sameCase`: cùng `case_id`, không giới hạn ngày (chỉ chạy khi có `caseId`).
  - `samePlate`: cùng biển số (chuẩn hóa bỏ ký tự không phải chữ/số, in hoa; so với `COALESCE(license_plate, case.bienSoXe)`), không giới hạn ngày.
  - Mỗi nhóm trả `{ items (tối đa 5, mới nhất trước), total }`. `excludeId` loại chính phiếu đang sửa.
- **Web**: `useGarageCashflowDuplicateGuard` (trong `garage-cashflow-drawer/`) gọi check trước khi lưu. Có trùng thì mở `ConfirmModal` (`danger={false}`) với nội dung `GarageCashflowDuplicateWarning` (molecule). Không trùng hoặc check lỗi (fail-open) thì lưu ngay.
  - Tạo mới: luôn check khi `amount > 0`. Sửa: chỉ check khi đổi `amount`, `transDate`, `caseId` hoặc biển số.
  - i18n: namespace `garage:cashflowDuplicate.*` trong `modules/garage/locales/{vi,en}.ts`. `useT` không nội suy nên component tự `.replace("{{x}}")`.
- **Test**: `garage-cashflow-duplicate.engine.spec.ts`, `GarageCashflowDuplicateWarning.test.tsx`, `useGarageCashflowDuplicateGuard.test.tsx`, nhóm "duplicate warning" trong `GarageCashflowDrawer.test.tsx`.

## Nguồn dữ liệu cho báo cáo Garage theo kỳ (cập nhật 2026-10-16)
- `kgara_cashflow_vouchers` là nguồn của sheet **Thu chi trong kỳ** và KPI **Đã thu / Đã chi** trên Dashboard xuất Excel tab Tổng quan (`GaragePeriodReportQueries.loadVouchers`, lọc `trans_date` trong kỳ, sắp tăng dần). `voucher_type`: `RECEIPT` = thu, `PAYMENT` = chi.
- Bảng **không có cột chi nhánh**: lọc chi nhánh qua `case_id` → `kgara_cases.branch_external_id` (giữ phiếu không gắn phiếu dịch vụ và phiếu của phiếu dịch vụ chưa có chi nhánh).
- Số liệu thực tế tại `erp_greenway_production` (2026-10-16): 289 phiếu (207 `RECEIPT`, 82 `PAYMENT`); `payment_content` hầu hết trống (249/289) nên sheet để trống cột Nội dung khi chưa phân loại.

## 9. Xuất Excel Thu Chi Garage (Export Background & Drawer 2-cột)
- **Kiến trúc Split-Button & Dropdown**:
  - Main button góc trên phải bảng `[ + Tạo phiếu mới | v ]`. Nút chính tạo phiếu mới, nút mũi tên chevron bên phải mở dropdown menu có nhóm `THAO TÁC` -> `Xuất Excel` (icon `FileSpreadsheet` xanh lá).
- **Drawer Xuất Excel 2-cột (`GarageCashflowExportDrawer`)**:
  - `layout="2-columns"`, `size="lg"`, kế thừa trải nghiệm chuẩn mực từ `cashflow?tab=bank`.
  - **Cột trái**: `GarageCashflowExportColumnSelector` (chọn cột động, gập/mở 3 nhóm: Thông tin chứng từ gồm Người tạo, Người cập nhật, Ngày tạo, Ngày cập nhật; Phát sinh & Thanh toán; Đối tác & Dịch vụ liên quan) + Bảng lịch sử xuất file 6 cột trong 24h kèm nút tải xuống, thời gian hết hạn và progress.
  - **Cột phải**: `GarageCashflowExportConditionSection` (hỗ trợ 2 chế độ radio card: `Theo kỳ` Tuần/Tháng/Quý/Tùy chỉnh ngày và `Theo filter hiện tại` với tóm tắt `GarageCashflowExportFilterPreview`, Combobox Tài khoản ngân hàng và Loại giao dịch).
  - **Cơ chế Auto-Download on Ready**: Tự động kích hoạt tải tệp XLSX về máy người dùng ngay khi job hoàn tất (thông qua SSE stream và fast polling 1.5s), không yêu cầu bấm tải thủ công.
- **Backend Export Job Runner & Template Excel (`exceljs`)**:
  - **Controller**: `GarageCashflowExportController` (`/api/v1/greenway/cashflow-vouchers/export/excel`), quyền `GARAGE_CASHFLOW:READ`.
    - `POST /background`: Khởi tạo job xuất ngầm với `GarageCashflowExportDto` (hỗ trợ `periodType: 'week' | 'month' | 'quarter' | 'year' | 'custom'`, `week`, `period`, `quarter`, `dateFrom`, `dateTo`, `accountId`, `voucherType`).
    - `GET /background/history`: Lấy lịch sử xuất file theo `userId`.
    - `GET /background/:jobId/download`: Tải file XLSX nhị phân.
    - `Sse /progress/stream`: Luồng SSE báo cáo tiến độ.
  - **Runner**: `cashflowRunner` trong `GarageExportJobsService` (kế thừa `ExportJobRunner`, processId `garage-cashflow-xlsx-export`).
  - **Builder**: `GarageCashflowExcelBuilder` tạo file Excel chuẩn:
    - Dòng 1: `TỔNG CỘNG (SUM)` với công thức `=SUM(...)`.
    - Dòng 2: `TỔNG THEO BỘ LỌC (SUBTOTAL)` với công thức `=SUBTOTAL(9, ...)`.
    - Dòng 4: Header Slate 700 (`#334155`), chữ trắng in đậm, freeze dòng đầu.
    - Dòng 5+: Dữ liệu phiếu thu chi kèm các cột `updatedBy`, `updatedAt`, định dạng số tiền `#,##0` và ngày tháng `dd/mm/yyyy`.

## Quy tắc phiếu chi: Trừ công nợ, Ghi garage-opex, Khóa trạng thái (cập nhật 2026-10-17)
Nguồn quy tắc: `helpers/garage-cashflow-payment-rules.ts` (có spec). Áp dụng trong `GarageCashflowTransactionService` (create/update/delete, cùng transaction).
- **Trừ công nợ garage** (`isDebtOffsetPayment`): phiếu `PAYMENT` + `payment_status = 'PAID'` + nội dung khác `4. HHBH`, `8. Vật tư tiêu hao`. Chỉ khi đó mới có dòng `kgara_case_settlements.settlement_type = 'PAYMENT'` (nguồn "Đã chi" của `/garage-debts`). Phiếu thu (`RECEIPT`) luôn có settlement. Đổi trạng thái/nội dung sẽ tạo hoặc gỡ settlement tương ứng.
- **Ghi garage-opex** (`isRecordedToOpex`): phiếu `PAYMENT` nội dung 4/8 ở trạng thái `APPROVED` hoặc `PAID`. `helpers/garage-cashflow-opex-sync.helper.ts` upsert 1 dòng `kgara_operating_expenses` theo `source_cashflow_voucher_id` (kỳ = tháng của `trans_date`), gỡ dòng khi không còn đủ điều kiện hoặc khi xóa phiếu. Map (cập nhật 2026-10-17): `4. HHBH` → `HHBH` (vào bucket `selling` của `getSummaryByPeriod`, hiện ở **mục 4.2 HHBH** trong mục IV "Chi phí bán hàng" của P&L, không ghi %); `8. Vật tư tiêu hao` → `VAT_TU_TIEU_HAO` (nhóm COGS, vào `directCost`, hiện ở mục II "Chi phí (Giá vốn)"). Migration `20261017120000-RemapCashflowOpexCategories` chuyển các dòng cũ có nguồn phiếu. Phiếu `PENDING` chưa ghi.
- **Khóa**: phiếu chi đã `PAID` không đổi được `paymentStatus` và `voucherType` (`BadRequestException` ở `updateVoucher`).
- Migration: `20261017100000-AddSourceCashflowVoucherToKgaraOperatingExpenses` (cột `source_cashflow_voucher_id`, FK `ON DELETE CASCADE`), `20261017101000-RouteGarageCashflowPaymentVouchers` (xóa settlement PAYMENT không đủ điều kiện, backfill dòng opex; `down()` không khôi phục settlement đã xóa).

## 10. Chuẩn Hóa Giao Diện Web (Cập nhật 2026-10-17)
- **Toolbar Combobox Dropdown**: Tích hợp `GarageViewModeCombobox` (kế thừa `ViewModeCombobox`) vào `customActionsNode` của `SpreadsheetPageTemplate`:
  - **Tầng 1 (Filter Group - Loại phiếu)**: `Tất cả` (`ALL`), `Phiếu thu (Tiền vào)` (`RECEIPT`), `Phiếu chi (Tiền ra)` (`PAYMENT`). Tự động đồng bộ với `tableHook.columnFilters['voucherType']`.
  - **Tầng 2 (Chế độ xem cột - View Presets)**: `Tổng quan` (`overview`), `Đối soát` (`reconciliation`), `Đầy đủ` (`all_columns`), lưu cấu hình vào `useUserPreferencesStore` (`garage-cashflow-column-views`).

## 11. Tab Tổng Quan Thu Chi Xưởng (Dashboard Tab & Atomic Design - Cập nhật 2026-10-17)
- **Định tuyến & Keep-Alive Tab Switching**:
  - Mặc định truy cập `/garage-cashflow` render `GarageCashflowTab` (Layer 3 Organism), tự động đồng bộ query param hai chiều `?tab=dashboard` (URL gắn `?tab=dashboard`, tương tự `/cashflow`).
  - Gồm 2 Top Tabs: **"Tổng quan"** (`dashboard`) và **"Danh sách phiếu thu chi"** (`vouchers`).
  - Cơ chế **Keep-Alive DOM**: Sử dụng `mountedViewsRef.current` và toggling qua CSS `className={currentTabKey === ... ? "..." : "hidden"}`, đảm bảo không mất state lọc/bảng khi chuyển đổi qua lại giữa Dashboard và Danh sách phiếu.
- **Cấu trúc Atomic Design 5 tầng (`/ui-atomic-refactor`, 100% file < 180 LoC)**:
  - **L1 Atoms**: `cashflow-kpi-badge` (`CashflowKpiBadge.tsx`, 35 LoC)
  - **L2 Molecules**:
    - `cashflow-legend-item` (`CashflowLegendItem.tsx`, 18 LoC)
    - `cashflow-top-row` (`CashflowTopRow.tsx`, 70 LoC)
  - **L3 Organisms**:
    - `garage-cashflow-kpi-cards` (`GarageCashflowKpiCards.tsx`, 102 LoC) - 3 thẻ KPI: Tiền vào (Thu - Emerald), Tiền ra (Chi - Orange), Dòng tiền ròng (Net).
    - `garage-cashflow-trend-panel` (`GarageCashflowTrendPanel.tsx`, 67 LoC) - Biểu đồ cột thu chi theo tháng.
    - `garage-cashflow-breakdown-panels` (`GarageCashflowBreakdownPanels.tsx`, 139 LoC) - 2 panels phân bổ theo Phương thức thanh toán và Nội dung thanh toán.
    - `garage-cashflow-top-txns-table` (`GarageCashflowTopTxnsTable.tsx`, 87 LoC) - Bảng Top 5 giao dịch thu lớn nhất và chi lớn nhất, tích hợp click mở Drawer.
    - `garage-cashflow-dashboard` (`GarageCashflowDashboard.tsx`, 120 LoC; hook 97 LoC) - Organism bọc `DashboardTemplate`, gỡ bỏ hoàn toàn Filter Panel (tối ưu hóa không gian hiển thị và trải nghiệm người dùng, tự động query theo chi nhánh `selectedBranchId`). Trang bị cụm nút chuẩn gồm Split Button **Xuất Excel** (tích hợp `GarageCashflowExportDrawer`) và nút **Tải lại (Reload)** đồng bộ với tab Sổ quỹ.
    - `garage-cashflow-tab` (`GarageCashflowTab.tsx`, 51 LoC; hook 74 LoC) - Bộ điều hướng giữ trạng thái 2 views.
  - **L4 Templates**: `DashboardTemplate` (khung chuẩn hoá của ERP Web).
  - **L5 Pages**: `GarageCashflowPage` (`GarageCashflowPage.tsx`, 23 LoC) - Entry point phân quyền RBAC `GARAGE_CASHFLOW:READ`.
- **No Blue Mandate**: 0 instance class `blue-`, dùng Emerald (`#059669`) cho Tiền vào, Orange (`#ea580c`) cho Tiền ra, Amber/Slate/Zinc cho các badges và borders.
- **Đa ngôn ngữ & Co-located Tests**: 100% chuỗi dùng i18n (`garageVi.cashflow.*`, `garageEn.cashflow.*`), 11 test suites co-located Vitest (39 tests) PASS 100%.

## 12. Dashboard Engine & Cơ Chế Lọc Chi Nhánh (`GarageCashflowDashboardEngine`)
- **Vị trí file**: `src/kgara-api-core/services/engines/garage-cashflow-dashboard.engine.ts`
- **Logic Lọc Chi Nhánh (`branchId`)**:
  - Giao diện `GarageBranchSelector` gửi `branchId` là `b.externalId` (ví dụ `0b4d6d3a-55df-492b-abaf-377d84b61d05` hoặc `CN1`).
  - Trong `applyBaseFilters`, engine thực hiện:
    ```typescript
    qb.leftJoin('v.case', 'c');
    qb.leftJoin(KgaraBranch, 'b', 'b.external_id = c.branch_external_id');
    qb.andWhere(
      '(c.branch_external_id = :branchId OR CAST(b.id AS TEXT) = :branchId OR b.name = :branchId OR b.code = :branchId)',
      { branchId },
    );
    ```
  - ⚠️ **Cấm dùng `c.branchName`**: Entity `KgaraCase` chỉ chứa cột `branch_external_id` (property `branchExternalId`), hoàn toàn không có cột `branchName` hay `branchname`. Truy vấn qua `c.branchName` sẽ gây lỗi Postgres 500: `column c.branchname does not exist`.
  - Bỏ qua lọc khi `branchId` là rỗng hoặc `'ALL'`.
- **Nguyên tắc bảo toàn bộ lọc (`andWhere` vs `where`)**:
  - Tại các hàm `getMethodBreakdown`, `getContentBreakdown` và `getTopTransactions`, điều kiện loại phiếu `v.voucher_type = :type` **BẮT BUỘC phải dùng `qb.andWhere(...)`**.
  - Tuyệt đối không dùng `qb.where(...)` sau khi đã gọi `applyBaseFilters`, vì `where()` của TypeORM sẽ xóa sạch toàn bộ các điều kiện lọc trước đó (`dateFrom`, `dateTo`, `paymentMethod`, `paymentContent`, `branchId`).

