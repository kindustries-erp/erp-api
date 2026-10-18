---
description: Quy trình tạo module erp-api theo kiến trúc v2 (Facade + sub-services + helpers + response DTO + spec co-located) bằng plop api-module-v2, và các bước đưa module cũ sang v2 theo lệnh người dùng
---

# 🧱 API v2 Module Architecture & Refactor Workflow (`/api-v2-refactor`)

Workflow này định nghĩa **API v2** trong `erp-api`: không đổi route, không đổi DB có sẵn. Một module v2 là module được sinh đúng cấu trúc đích ngay từ đầu, và các module cũ chỉ chuyển sang v2 khi người dùng ra lệnh (rolling migration).

Skill đi kèm (quy ước, bẫy, checklist): [`./../skills/api-v2-refactor/SKILL.md`](../skills/api-v2-refactor/SKILL.md)
Generator: `api-module-v2` (xem [`plop-generate`](../skills/plop-generate/SKILL.md), mục Generator 3)

---

## 🎯 Định nghĩa API v2

```
src/v2/<module>-core/
  entities/<entity>.entity.ts              # TypeORM, cột snake_case, cờ isDeleted
  dto/create-<e>.dto.ts                    # validation (class-validator)
  dto/update-<e>.dto.ts                    # PartialType(Create)
  dto/query-<e>.dto.ts                     # extends PaginationDto
  dto/<e>-response.dto.ts                  # hình dạng trả ra API (không trả entity)
  helpers/<e>.mapper.ts (+ .spec)          # hàm thuần: entity <-> DTO
  services/<e>-query.service.ts (+ .spec)  # đọc: phân trang, tìm kiếm, lấy theo id
  services/<e>-command.service.ts (+ .spec)# ghi: create, update, softDelete
  <module>.service.ts (+ .spec)            # Facade: điều phối và map sang response DTO
  controllers/<e>.controller.ts (+ .spec)  # RBAC (ErpResource/ErpAction) + Swagger
  <module>.module.ts
```

Bốn quy tắc cứng:
1. **Không lộ entity**: controller và facade chỉ trả response DTO (mapper làm việc đó).
2. **Constructor DI sạch**: một chữ ký duy nhất, không overload, không union type.
3. **Spec co-located**: mỗi đơn vị có `*.spec.ts` cạnh file nguồn.
4. **Ngưỡng kích thước**: controller ≤ 300 LoC, service ≤ 500 LoC, helper/engine ≤ 800 LoC. Vượt ngưỡng thì dùng `/api-service-refactor`.

---

## 🧭 5 Giai Đoạn

### Giai đoạn 1: Discovery (chỉ đọc)
1. Xác định module đích và bảng: đọc `.agents/skills/modules/<module>/SKILL.md` nếu module đã có.
2. Kiểm tra DB đúng với `.env` theo quy tắc workspace: chạy `SELECT current_database();` trước khi đọc schema, báo tên DB cho người dùng.
3. Kiểm tra trùng: `routePath` (không trùng controller khác), `ErpResource` (không trùng key/value trong `src/rbac-core/enums/erp-resource.enum.ts`), tên entity.
4. Chốt danh sách trường (`fieldSpec`) với người dùng. Mọi quyết định nghiệp vụ (mã duy nhất, trạng thái, số tiền) phải được chốt trước khi sinh.

### Giai đoạn 2: Scaffold bằng plop
```bash
cd erp/erp-api
bunx plop api-module-v2 <module-core> <Entity> "<fieldSpec>" "<tableName>" "<routePath>" "<permissionResource>" <wire>
```
- Thứ tự tham số: `moduleInput`, `entityInput`, `fieldSpecInput`, `tableNameInput`, `routePathInput`, `permissionResourceInput`, `wireInput`.
- Để chuỗi rỗng `""` để dùng giá trị mặc định (bảng `erp_<module>`, route và resource theo module bỏ `-core`).
- `fieldSpec`: `name:type[:required],...`, type ∈ `string | text | number | decimal | boolean | date | status`. `createdAt` được sinh tự động.
- `wire = true`: nối module vào `src/app.module.ts` và entity vào `src/db/data-source.ts`. Resource RBAC **luôn** được thêm vào `erp-resource.enum.ts`.
- Input sai sẽ dừng trước khi ghi file nào.
- Sau khi sinh: `bunx prettier --write "src/v2/<module>-core/**/*.ts"`.

### Giai đoạn 3: Nghiệp vụ (làm tay, có test)
Code sinh ra là CRUD hoàn chỉnh nhưng **chưa có nghiệp vụ**. Bổ sung ở đúng lớp:
- Kiểm tra trùng mã, quy tắc trạng thái: `<entity>-command.service.ts` (thêm vào `create`/`update`, kèm spec).
- Giao dịch ghi số dư/tồn kho: `QueryRunner` + `setLock('pessimistic_write')` trong command service.
- Phân quyền theo dữ liệu (tenant, đối tác): thêm điều kiện vào `query.service.ts`.
- Nhật ký thao tác: `erp_audit_logs` / `audit-core`.
- Mọi thay đổi nghiệp vụ phải có spec tương ứng (TDD khi có thể).

### Giai đoạn 4: Kiểm tra cấu trúc
- Controller không trả entity (chỉ gọi facade). Facade không trả entity.
- Mỗi sub-service và mapper có spec cạnh file.
- Không có constructor overload hay union type.
- Chạy scanner ngưỡng kích thước:
  ```bash
  bun .agents/skills/api-service-refactor/scripts/scan-oversized-files.ts --strict
  ```

### Giai đoạn 5: Quality Gate
Chạy theo phạm vi thu hẹp trong lúc làm, rồi một lần duy nhất ở commit cuối:
```bash
bun run type:check                                 # tsc --noEmit
bunx jest src/v2/<module>-core --forceExit            # spec của module
bunx eslint "src/v2/<module>-core/**/*.ts" --max-warnings=0
bun run verify:final                               # chỉ một lần, trên commit cuối
```
- Test generator (chỉ khi sửa `plop-helpers/`): `bun test plop-helpers` (jest không chạy các file này vì `rootDir` là `src`).
- Cập nhật module skill theo Knowledge-Sync: `.agents/skills/modules/<module>/SKILL.md` (hoặc `/scan-module-knowledge`).

---

## 🔁 Đưa module cũ sang v2 (rolling, theo lệnh người dùng)

Không tự động migrate. Chỉ làm khi người dùng ra lệnh cho từng module:
1. Đọc module hiện tại và liệt kê các endpoint, DTO, và phụ thuộc từ module khác (module khác import service này).
2. Giữ nguyên hợp đồng: cùng route, cùng hình dạng response, cùng quyền RBAC.
3. Lưu bản gốc file cũ ra ngoài repo (scratchpad), xóa file trùng tên với generator, rồi sinh. Không để `*.legacy.ts` trong `src/`, vì tsc sẽ lỗi. Chi tiết: skill `api-v2-refactor` mục 3b. So sánh response với bản gốc bằng spec hợp đồng.
4. Chuyển controller và module cũ sang facade mới, xóa code cũ sau khi spec pass.
5. Báo cáo: danh sách endpoint đã kiểm tra và phụ thuộc đã cập nhật.

---

## ⚠️ Giới hạn đã biết
- Generator không sinh nghiệp vụ, phân quyền theo dữ liệu, hay audit log: phải làm ở Giai đoạn 3.
- Generator không gán quyền cho vai trò trong RBAC. Thêm resource vào enum chỉ đăng ký khả năng, quyền cấp cho vai trò quản lý ở module RBAC.
- Mô hình xóa dùng cờ `isDeleted` (đúng quy ước repo), không dùng `DeleteDateColumn`. Template `api-module` cũ dùng `deletedAt` và không nên dùng cho module mới.
