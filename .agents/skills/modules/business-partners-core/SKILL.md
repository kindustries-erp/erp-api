---
name: business-partners-core
description: Module tri thức Đối tác (Khách hàng & Nhà cung cấp) phía API erp-api (src/v2/business-partners-core). Bảng erp_business_partners, hợp đồng API v2 (envelope, lọc/sắp xếp/subtotal qua table-query), quy tắc sinh mã NCC-/KH-/DT-, kiểm tra trùng mã, RBAC business_partners và các module phụ thuộc entity.
---

# 📦 Module Tri Thức: Business Partners Core (API)

## 1. Phạm vi

- Route: `/api/v1/business-partners`. Quyền: `ErpResource.BUSINESS_PARTNERS` (`business_partners`) với READ, CREATE, UPDATE, DELETE.
- Phân loại bằng `partnerType`: `CUSTOMER` (khách hàng) hoặc `VENDOR` (nhà cung cấp). Loại khác được chấp nhận và sinh mã tiền tố `DT-`.
- Xóa là xóa mềm (`isDeleted`). Không có audit log, không có khóa bi quan (không có số dư).
- Web tiêu thụ: V1 `src/modules/business-partners-core`, `src/modules/partners`, PO drawers; V2 `src/v2/modules/business-partners` (xem skill `business-partners` của erp-web).

## 2. Cấu trúc

```text
src/v2/business-partners-core/
├── business-partners-core.module.ts        # imports TypeORM, providers, exports facade
├── business-partners-core.service.ts       # Facade: sinh mã, envelope, NotFound
├── business-partners-core.service.spec.ts  # nghiệp vụ + hợp đồng response
├── controllers/erp-business-partner.controller.ts (+ .spec)
├── dto/                                    # create/update/query/response (sinh bởi api-module-v2)
├── entities/erp_business_partner.entity.ts # entity dùng chung, nhiều module import (đường dẫn đã cập nhật khi chuyển sang v2)
├── helpers/
│   ├── erp-business-partner.mapper.ts (+ .spec)       # entity <-> response DTO
│   └── erp-business-partner-code.helper.ts (+ .spec)  # sinh mã, chuẩn hóa mã (hàm thuần)
└── services/
    ├── erp-business-partner-query.service.ts (+ .spec) # lọc, sắp xếp, tổng, column-options, mã đã dùng
    ├── erp-business-partner-command.service.ts (+ .spec) # kiểm tra trùng mã và MST, create/update/softDelete
    ├── erp-business-partner-invoice-sync.service.ts (+ .spec) # đồng bộ đối tác từ hóa đơn (1 MST = 1 đối tác), ensureFromInvoiceKey
    └── erp-business-partner-options.service.ts (+ .spec) # danh sách chọn đối tượng cho sao kê (danh mục + người mua/bán chưa có)
```

Helper khóa dùng chung (ngoài module): `src/common/utils/invoice-partner-key.util.ts` (MST/CCCD, biểu thức SQL tên/MST từ hóa đơn; công nợ và đồng bộ dùng chung).

Sinh bằng `api-module-v2` (xem skill `api-v2-refactor`, mục 3b về chuyển module cũ).

## 3. Schema (đã xác minh đối chiếu với DB, chỉ đọc)

Bảng `erp_business_partners`: `id uuid` (PK), `code varchar(255) NOT NULL` (unique index toàn cục), `name` (bắt buộc), `display_name`, `partner_type` (bắt buộc), `tax_code`, `phone`, `email`, `address text`, `contact_name`, `status varchar(255) NOT NULL` (mặc định `ACTIVE`), `notes text`, `is_deleted boolean NOT NULL`, `created_at`, `updated_at` (timestamp không múi giờ).

Index unique trên `code` chỉ áp dụng cho bản ghi chưa xóa mềm (partial, sau migration `20261018160000`). Trước migration, index DB là unique toàn bảng.

## 4. Hợp đồng API

| Endpoint | Response |
| :--- | :--- |
| `GET /` | `{ items, total, page, pageSize, totalPages, summaries }` |
| `GET /column-options?column&search&page&pageSize&filters&partnerType` | `{ items: [{label, value}], total, next }` |
| `GET /next-code?partnerType` | `{ nextCode }` |
| `GET /:id` | `{ message, data }` |
| `POST /` | `{ message: 'Tạo thành công', data }` |
| `PATCH /:id` | `{ message: 'Cập nhật thành công', data }` |
| `DELETE /:id` | `{ message: 'Xóa thành công', data }` (xóa mềm) |
| `GET /options?direction=IN\|OUT&search&page&pageSize` | `{ items: [{partnerId, code, name, taxCode, partnerType, source: MASTER\|INVOICE}], total, page, pageSize, totalPages }`. Quyền: một trong `business_partners`, `bank_statements`, `cash_statements` (READ). `OUT` = khách hàng (tiền thu), `IN` = NCC (tiền chi) |
| `POST /sync-from-invoices` | Body `{ dryRun?: boolean }` → `{ message, dryRun, count, items: [{taxCode, name, address, partnerType}] }`. Tạo đối tác cho từng MST còn thiếu (1 MST = 1 đối tác, loại theo chiều có nhiều hóa đơn hơn, hòa → CUSTOMER). Chạy lại không tạo trùng. Quyền: `business_partners` CREATE |

- `data` là response DTO: `id, code, name, displayName, partnerType, taxCode, phone, email, address, contactName, status, notes, createdAt, updatedAt`. Không có `isDeleted` (V1 có trả trường này).
- `summaries` là `{}` vì BP không có cột số. Web tự đặt `summaries.code = total` cho ô đếm.
- `status` validate `IsIn(ACTIVE, INACTIVE)` (sinh từ fieldSpec `status`). V1 nhận chuỗi tự do.

### 4.1 Lọc, sắp xếp, tìm kiếm

- Tham số: `search` (toàn cục trên 7 cột: code, name, displayName, taxCode, phone, email, contactName; nhiều từ khóa cách nhau bằng `;`), `partnerType`, `status`, `sort` (`a,-b`), `column_filters`, `column_search`, `column_operators`, `date_ranges`, `date_from`/`date_to` (áp cho `createdAt`, múi giờ +07:00).
- Cột lọc được (whitelist `TABLE_COLUMNS`): code, name, displayName, partnerType, taxCode, phone, email, address, contactName, status, notes, createdAt. Key camelCase và snake_case đều được chấp nhận.
- Logic lọc dùng helper chung `src/common/utils/table-query/` (không còn `business-partners-query-filter.util.ts`).

### 4.2 Quy tắc mã

- Không nhập mã: tự sinh theo loại. Tiền tố: `NCC-` (VENDOR hoặc không truyền), `KH-` (CUSTOMER), `DT-` (loại khác). Số = lớn nhất đuôi số trong các mã có tiền tố hoặc thuộc loại đó, cộng 1, đệm 3 chữ số.
- Mã nhập vào được `trim` và viết hoa trước khi kiểm tra.
- Trùng mã: so sánh không phân biệt hoa thường, chỉ với bản ghi chưa xóa mềm. Khi sửa thì loại trừ chính bản ghi đó. Trùng thì trả 400 `Mã đối tác "X" đã tồn tại trên hệ thống`.
- Khi sửa, mã rỗng hoặc chỉ có khoảng trắng thì giữ mã cũ.
- Mã đã xóa mềm không dùng lại được (xem mục 7).

### 4.3 Quy tắc MST

- MST (`taxCode`) sau khi trim là khóa gom đối tác từ hóa đơn: một MST chỉ thuộc một đối tác chưa xóa mềm. Tạo/sửa trùng MST trả 400 `MST "X" đã thuộc đối tác "CODE"` (kiểm ở `ErpBusinessPartnerCommandService.assertTaxCodeAvailable`, không có ràng buộc DB).
- Index `IDX_erp_business_partners_tax_code` (partial, `is_deleted = false`) để tra cứu khi đồng bộ.
- Khóa tìm-hoặc-tạo từ hóa đơn (`ensureFromInvoiceKey`): có MST thì theo MST; không có MST thì theo tên (không phân biệt hoa thường, chỉ đối tác không MST).

## 5. Phụ thuộc từ module khác

Entity `ErpBusinessPartner` (`src/v2/business-partners-core/entities/`) được import bởi: `sales-orders-core`, `goods-issues-core`, `goods-receipts-core`, `purchase-orders-core` (ManyToOne `supplier`), `operating-expenses-core` (ManyToOne `supplier`), `public-warranty`, `basic-masters-core`, `bank-transactions-core` (ManyToOne `partner` trên `erp_bank_transactions.partner_id`, `ON DELETE SET NULL`), `db/data-source.ts`, và các script seed.

Module nhận `BusinessPartnersCoreService` (export từ `BusinessPartnersCoreModule`): `bank-transactions-core` (gọi `ensurePartnerForInvoiceKey` khi gán đối tượng từ hóa đơn, và `listOptions` cho danh sách chọn).

Đổi tên hoặc đổi cột entity sẽ ảnh hưởng tất cả các module trên.

## 6. Kiểm thử

```bash
cd erp/erp-api
bunx jest src/v2/business-partners-core src/common/utils/table-query --forceExit
bunx tsc --noEmit
bunx eslint "src/v2/business-partners-core/**/*.ts" --max-warnings=0
```

## 7. Hạn chế đã biết (giữ hành vi V1, chưa sửa)

- **Trùng với mã đã xóa mềm gây 500 (đã sửa trong code, chưa chạy trên DB).** Entity khai báo partial unique index `UQ_erp_business_partners_code_active` (`WHERE is_deleted = false`). Migration `20261018160000-PartialUniqueBusinessPartnerCode.ts` thay index cũ `IDX_41e4debe2f4b2b1b011a6c6a9f`. Trước khi chạy, kiểm tra không có mã trùng giữa các bản ghi chưa xóa (đã kiểm tra chỉ đọc trên DB hiện tại: 0 nhóm).
- Thay đổi có chủ đích so với V1: `GET`, `PATCH`, `DELETE` trên bản ghi đã xóa mềm trả 404. V1 `remove` không kiểm tra `isDeleted` nên xóa lại được và ghi đè bản ghi.
- `PATCH :id` và `DELETE :id` dùng `ParseUUIDPipe`, id sai định dạng trả 400 (V1 không có).

## 8. Liên quan

- Skill tổng: `api-v2-refactor` (hợp đồng, bẫy, quy trình chuyển module cũ).
- Web: `erp-web/.agents/skills/modules/business-partners/SKILL.md`.
