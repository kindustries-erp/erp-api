# Chuyển entity nhân viên ra khỏi `employees-core` sang `employees-management` (erp-api)

Track: T2 (anh ra lệnh trực tiếp cho module employees)
Structure: /erp-api-structure (Phần B: đưa `employees-core` về lõi base-only, theo mẫu `branches-core` ở commit `8785658b`)
Consistency Check: đạt (AC ↔ Task ở bảng cuối)
Plane: KINDU-1706..1719 (Module employees-core-base-only, Cycle "Phase: employees-core base-only (2027-02-22)")

## Context
- Test `plop-helpers/apiCoreLayout.test.mjs` đỏ vì `src/v2/core/employees-core/entities/employee-management.entity.ts` có `@Entity`. Lõi chỉ được là base để kế thừa; entity cụ thể, bảng, Nest module, service cụ thể thuộc module.
- Lỗi có từ commit `490384cf` (dựng Employees V2), không liên quan cases-garage. Mục tiêu: test xanh mà không thêm `employees-core` vào `LEGACY_CORE_ALLOWLIST`.
- **Không đổi DB**: bảng `employees_management`, cột, index, FK giữ nguyên. Đây là refactor code thuần, không có migration. Route `api/v2/employees` và response giữ nguyên (không có Web follow-up).

## Discovery (đã đọc)
- Lõi hiện chứa 4 nhóm: entity (76 dòng), DTO (6 file), helpers (mã NV, ngày, CCCD, strict-json, mapper), services (query 240, command 123, facade `EmployeesCoreService` 155) và `EmployeesCoreModule` (Nest module, `TypeOrmModule.forFeature`, export `TypeOrmModule` cho users-management).
- Module `employees-management` hiện chỉ có controller + facade mỏng gọi `EmployeesCoreService`, import `EmployeesCoreModule`.
- Consumer entity ngoài họ: `db/data-source.ts`; `approval-core/approval-actor.service.ts` (import tương đối, `approval-core` đã nằm trong allowlist legacy vì lý do này nên chỉ đổi đường dẫn); `users-management` (module, 5 service/mapper + 4 spec); `cases-garage` (`case-progress-{command,query}.service.ts`); `auth-sessions/helpers/auth.mapper.ts`.
- Mẫu đúng: `branches-core` = `BaseBranchEntity` (không `@Entity`) + contract + service trừu tượng, `core.manifest.json` style `v2-core`, `module: null`; module `branches-management` giữ entity cụ thể, service, DTO, mapper, Nest module.
- `employees-core` chưa có chỗ nào khác dùng service/DTO/helper của lõi ngoài `employees-management` (đã grep), nên không cần `export` lại từ lõi.

## Thiết kế

| Nơi | Chứa |
|---|---|
| **Lõi** `src/v2/core/employees-core/` (sau khi sửa) | `BaseEmployeeEntity extends CoreSoftDeletableEntity`: các cột dùng chung mọi ngành (`employeeCode`, `fullName`, `email`, `phone`, `status`, `userId`, `address`, `notes`, `birthDate`, `startDate`, `leaveDate`, `jobTitle`, `department`, `branchId`, `nationalId`) chỉ có `@Column`, **không** `@Entity`, **không** `@Index`; kiểu `EmployeeRef` (contract tối thiểu cho module khác); `core.manifest.json` style `v2-core`, `module: null`; barrel. |
| **Module** `src/v2/modules/employees-management/` | `EmployeeManagement extends BaseEmployeeEntity` với `@Entity({ name: 'employees_management' })`, 3 `@Index` partial-unique khai báo ở cấp class (tên giữ nguyên `UQ_employees_management_code_active`, `…_user_id`, `…_national_id_active`), quan hệ chuỗi `@ManyToOne('BranchManagement')`; `dto/`, `helpers/`, `services/` (query, command, facade); `EmployeesManagementModule` tự `TypeOrmModule.forFeature([EmployeeManagement])` và **export `TypeOrmModule`** + các service. |
| Xóa | `EmployeesCoreModule` (Nest module của lõi), `employees-core.module.ts`, các `services/`, `dto/`, `helpers/` ở lõi sau khi đã di chuyển. |

Quyết định thiết kế (giả định, anh sửa được ở bước duyệt):
1. **Không dựng service trừu tượng ở lõi** (khác `branches-core`). Lý do: chỉ có một họ nhân viên cụ thể, thêm lớp trừu tượng là thừa. Khi có ngành thứ hai cần dùng chung mới tách.
2. **`EmployeesManagementService` (facade) gọi trực tiếp query/command service của module**; bỏ `EmployeesCoreService` (không còn lớp "core" thừa).
3. **`@Index` chuyển từ decorator thuộc tính sang cấp class ở module**; TypeORM vẫn nhận cột kế thừa. Kiểm chứng bằng việc schema không lệch (1.1.1).
4. `approval-core` chỉ đổi đường dẫn import (tiếp tục nằm trong allowlist legacy, không mở rộng phạm vi).
5. `users-management` giữ `TypeOrmModule.forFeature([EmployeeManagement])` riêng, chỉ đổi đường dẫn import.

Đảo chiều phụ thuộc: lõi không import module; module import lõi. Tránh vòng: `employees-management` → `branches-core` (kiểu `BranchRef`), quan hệ tới `BranchManagement` vẫn bằng chuỗi.

## Rollback
Không có thay đổi dữ liệu. Hoàn tác bằng `git revert` commit (không cần migration down). Backup DB không cần vì không chạm DB.

## Task Breakdown

### Phase 1 — Database
- [x] **1.1.1 Chốt schema không đổi (trước khi sửa)** · `SELECT current_database()` báo tên DB; ghi lại `\d employees_management` (cột, index, FK) làm mốc · Files: không · DoD: có mốc để đối chiếu · Verification: `psql … -c "\d employees_management"` (read-only)

### Phase 2 — API
- [x] **2.1.1 Tạo `BaseEmployeeEntity` + `EmployeeRef`; sửa manifest, barrel của lõi** · `[NEW] src/v2/core/employees-core/entities/base-employee.entity.ts`, `contracts/employee.contract.ts`; `[MODIFY] core.manifest.json`, `index.ts`, `entities/index.ts` · DoD: lõi không còn `@Entity`/`@Index`; manifest `v2-core`, `module: null` · Verification: `bunx tsc --noEmit`
- [x] **2.1.2 Entity cụ thể ở module** · `[NEW] src/v2/modules/employees-management/entities/employee-management.entity.ts` (+ `entities/index.ts`) · DoD: tên bảng, cột, tên 3 index và FK trùng bản cũ · Verification: `bunx tsc --noEmit`
- [x] **2.2.1 Di chuyển DTO** (7 file) bằng `git mv` · `[MODIFY→MOVE] dto/*` sang module, cập nhật import · Verification: `bunx tsc --noEmit`
- [x] **2.2.2 Di chuyển helpers + spec** (mã NV, ngày, CCCD, strict-json, mapper) · Verification: `bunx jest src/v2/modules/employees-management/helpers`
- [x] **2.2.3 Di chuyển services + spec; bỏ `EmployeesCoreService`, facade gọi trực tiếp** · `[MOVE] employee-query/command.service.ts`, `[MODIFY] employees-management.service.ts` (+spec) · DoD: mỗi file dưới ngưỡng, Clean DI · Verification: `bunx jest src/v2/modules/employees-management/services src/v2/modules/employees-management/employees-management.service`
- [x] **2.3.1 Nest module: `EmployeesManagementModule` tự đăng ký entity và export `TypeOrmModule` + service; xóa `EmployeesCoreModule`** · `[MODIFY] employees-management.module.ts`, `[DELETE] core/employees-core/employees-core.module.ts`; cập nhật `employees-management.di.spec.ts` · Verification: `bunx jest src/v2/modules/employees-management/employees-management.di.spec.ts`
- [x] **2.3.2 Cập nhật consumer** (đổi import sang `@/v2/modules/employees-management`): `db/data-source.ts`; `approval-core/approval-actor.service.ts`; `users-management` (module, 5 file + 4 spec); `cases-garage/services/case-progress-{command,query}.service.ts`; `auth-sessions/helpers/auth.mapper.ts` · DoD: `grep -rn "core/employees-core/entities/employee-management\|employees-core/entities/employee-management" src` rỗng · Verification: `bunx tsc --noEmit`; `bunx jest --findRelatedTests` các file đã sửa

### Phase 3 — QC & Knowledge
- [x] **3.1.1 Test layout + scope liên quan + type:check** · `bun test plop-helpers/apiCoreLayout.test.mjs` (4/4 PASS, allowlist không đổi); `bunx jest src/v2/modules/employees-management src/v2/modules/users-management src/v2/modules/auth-sessions src/v2/core/approval-core src/v2/modules/cases-garage --forceExit`; `bun run type:check`; `bun .agents/skills/erp-api-structure/scripts/scan-oversized-files.ts --strict` không báo file của họ employees
- [x] **3.1.2 Xác nhận schema không lệch** · so `\d employees_management` với mốc 1.1.1 (staging, báo tên DB) + khởi động API `start:dev` không lỗi metadata TypeORM + smoke `bun run test:smoke:employees` (tài khoản `ai-test-*`)
- [x] **3.2.1 Knowledge Sync** · `[MODIFY] .agents/skills/modules/employees-core/SKILL.md` (vị trí lõi/module, bỏ `EmployeesCoreModule`/`EmployeesCoreService`, lệnh test), `erp-users/SKILL.md` dòng 234 nếu nhắc; chạy `/sync-agents`; `bash .agents/scripts/validate-agent-system.sh`

## Spec: tiêu chí chấp nhận
| AC | Task | Verification |
|---|---|---|
| AC-1 Lõi `employees-core` không còn `@Entity`/`@Controller`/Nest module; test layout 4/4 xanh, allowlist không đổi | 2.1.1, 2.3.1 | `bun test plop-helpers/apiCoreLayout.test.mjs` |
| AC-2 Entity cụ thể nằm ở module, `extends` lõi, schema DB không lệch | 2.1.2, 1.1.1, 3.1.2 | so `\d employees_management`, API khởi động |
| AC-3 Route `api/v2/employees` và response không đổi | 2.2.x, 3.1.2 | jest controller + smoke employees |
| AC-4 Mọi consumer (users-management, approval-core, cases-garage, auth-sessions, data-source) biên dịch và test xanh | 2.3.2, 3.1.1 | tsc + jest scope |
| AC-5 Skill tri thức khớp mã nguồn, không DRIFT | 3.2.1 | `sync-agents --check`, validate-agent-system |

## ❓ Open Questions (giả định đã chọn, anh sửa được)
- [ ] Không dựng service trừu tượng ở lõi (khác `branches-core`).
- [ ] Bỏ `EmployeesCoreService`, facade module gọi thẳng query/command service.
- [ ] `approval-core` chỉ đổi đường dẫn import, không xử lý thêm nợ legacy của họ này.

## Final Gate
Commit trong `erp/erp-api` trên `erp-master` (pre-commit lint + jest liên quan) → `git pull --rebase github-industries erp-master` → push (pre-push `type:check`) → xác nhận CI xanh. Chỉ commit/push khi anh yêu cầu.
