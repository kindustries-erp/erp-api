# 🚀 Walkthrough: Restructure `business-partners` theo chuẩn `/api-structure` (V2 Core & Modules)

- **Repo**: `erp/erp-api`
- **Branch**: `erp-master`
- **Trạng thái**: ✅ **Hoàn thành 100%**
- **Plane Tracking**: Story **KINDU-396** & Tasks **KINDU-397 → KINDU-406** (Đã chuyển trạng thái `Done`).

---

## 1. Kết Quả Tái Cấu Trúc Kiến Trúc

Thư mục cũ `src/v2/business-partners-core/` đã được phân rã hoàn toàn và chuyển đổi thành 2 tầng chuẩn mực của V2:

### 1.1 Tầng Core: `src/v2/core/business-partners-core/`
Cung cấp nền tảng domain và persistence dùng chung cho toàn bộ hệ thống ERP:
- **`core.manifest.json`**: Manifest chuẩn hóa họ `business-partners-core` (đã verify tự động bằng `listCoreFamilies` và `readCoreManifest`).
- **`contracts/business-partner.contract.ts`**: Hợp đồng interface (`IBusinessPartner`, `PartnerType`).
- **`entities/erp_business_partner.entity.ts` & `entities/index.ts`**: Entity `ErpBusinessPartner` trung tâm của hệ thống.
- **`helpers/`**: Helper sinh mã đối tác (`erp-business-partner-code.helper.ts`) và mapper (`erp-business-partner.mapper.ts`) kèm đầy đủ unit tests.
- **`services/`**:
  - `erp-business-partner-query.service.ts`: Query service lọc đa chiều, phân trang, column options.
  - `erp-business-partner-command.service.ts`: Command service kiểm tra trùng mã, MST, tạo/sửa/xóa mềm.
  - `erp-business-partner-invoice-sync.service.ts`: Đồng bộ đối tác từ hóa đơn, `ensureFromInvoiceKey`.
  - `erp-business-partner-options.service.ts`: Tra cứu danh sách đối tượng chọn cho sao kê.
  - `business-partners-core.service.ts`: Facade lõi dùng chung cho các module khác.
- **`business-partners-core.module.ts`**: Module cung cấp `TypeOrmModule.forFeature([ErpBusinessPartner])` và các service.
- **`index.ts`**: Barrel export toàn bộ qua alias `@/v2/core/business-partners-core`.

### 1.2 Tầng Module: `src/v2/modules/business-partners-management/`
Presentation layer phục vụ REST HTTP endpoints:
- **`controllers/erp-business-partner.controller.ts`**: REST Controller phục vụ song song:
  `@Controller(['api/v2/business-partners', 'business-partners'])`
  Đảm bảo Web V2 gọi `/api/v2/business-partners` và Web V1 gọi `/api/v1/business-partners` **hoạt động bình thường 100% không đổi**.
- **`business-partners-management.service.ts`**: Facade service của module HTTP delegate sang `BusinessPartnersCoreService`.
- **`business-partners-management.module.ts`**: Module đăng ký controller và providers, import `BusinessPartnersCoreModule`.
- **Specs co-located**:
  - `erp-business-partner.controller.spec.ts`
  - `erp-business-partner.routes.spec.ts` (kiểm tra cả 2 route `/api/v2/business-partners` và `/api/v1/business-partners`)
  - `business-partners-management.service.spec.ts`

### 1.3 Cập nhật phụ thuộc hệ thống
Đã cập nhật toàn bộ import trỏ sang `@/v2/core/business-partners-core`:
- `src/app.module.ts`: Đăng ký `BusinessPartnersManagementModule`.
- `src/db/data-source.ts`: Import `ErpBusinessPartner`.
- `src/bank-transactions-core/`: Module, service `TransactionAccountingService`, entity `ErpBankTransaction`.
- `src/sales-orders-core`, `src/goods-issues-core`, `src/goods-receipts-core`, `src/purchase-orders-core`, `src/operating-expenses-core`, `src/public-warranty`, `src/basic-masters-core`, `src/v2/modules/purchase-orders`.
- Xóa sạch thư mục cũ `src/v2/business-partners-core`.

---

## 2. Bằng Chứng Xác Minh (Verification Evidence)

### 2.1 TypeCheck
```bash
$ bun run type:check
> NODE_OPTIONS="--max-old-space-size=1536" tsc --noEmit
# Exit code: 0 (No errors)
```

### 2.2 Unit Tests & Route Invariant
```bash
$ bunx jest src/v2/core/business-partners-core src/v2/modules/business-partners-management --forceExit

PASS src/v2/core/business-partners-core/helpers/erp-business-partner.mapper.spec.ts
PASS src/v2/core/business-partners-core/helpers/erp-business-partner-code.helper.spec.ts
PASS src/v2/core/business-partners-core/services/erp-business-partner-command.service.spec.ts
PASS src/v2/core/business-partners-core/services/erp-business-partner-invoice-sync.service.spec.ts
PASS src/v2/core/business-partners-core/services/erp-business-partner-query.service.spec.ts
PASS src/v2/core/business-partners-core/services/business-partners-core.service.spec.ts
PASS src/v2/core/business-partners-core/services/erp-business-partner-options.service.spec.ts
PASS src/v2/modules/business-partners-management/business-partners-management.service.spec.ts
PASS src/v2/modules/business-partners-management/controllers/erp-business-partner.controller.spec.ts
PASS src/v2/modules/business-partners-management/controllers/erp-business-partner.routes.spec.ts

Test Suites: 10 passed, 10 total
Tests:       63 passed, 63 total
Snapshots:   0 total
Time:        1.54 s
```

### 2.3 Tests hồi quy các module liên quan
```bash
$ bunx jest src/bank-transactions-core src/v2/modules/purchase-orders src/public-warranty --forceExit
Test Suites: 23 passed, 23 total
Tests:       134 passed, 134 total
Time:        2.77 s
```

### 2.4 Quét Kích Thước File & Clean DI Scanner
```bash
$ bun .agents/skills/erp-api-structure/scripts/scan-oversized-files.ts --strict --path=src/v2/core/business-partners-core
✔ Không có file nào vượt ngưỡng.
✔ Không phát hiện vi phạm Clean DI Constructor.

$ bun .agents/skills/erp-api-structure/scripts/scan-oversized-files.ts --strict --path=src/v2/modules/business-partners-management
✔ Không có file nào vượt ngưỡng.
✔ Không phát hiện vi phạm Clean DI Constructor.
```

### 2.5 Knowledge-Sync Guard
- Đã cập nhật `.agents/skills/modules/business-partners-core/SKILL.md`.
- Đã cập nhật `.agents/skills/erp-api-truth/SKILL.md`.
- Đã cập nhật `.agents/skills/erp-api-structure/references/v2-module.md`.
