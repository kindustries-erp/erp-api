# 🚀 Walkthrough & Verification Report: Di Chuyển Enums `rbac-core` Sang `v2/core/rbac` & Xóa Bỏ `src/rbac-core`

## 📝 Tóm tắt thay đổi

Đã hoàn thành việc di dời toàn bộ phần còn lại trong `src/rbac-core` vào `src/v2/core/rbac`:

| Phân hệ | File / Thư mục | Loại | Mô tả |
| :--- | :--- | :---: | :--- |
| **API (Lõi)** | `src/v2/core/rbac/enums/` | `[NEW]` | Chứa `erp-action.enum.ts`, `erp-resource.enum.ts`, `index.ts` |
| **API (Lõi)** | `src/v2/core/rbac/index.ts` | `[MODIFY]` | Export toàn bộ enums (`export * from './enums';`) qua barrel chung `@/v2/core/rbac` |
| **API (Lõi)** | `src/v2/core/rbac/helpers/` & `services/` | `[MODIFY]` | Cập nhật relative import nội bộ sang `../enums` |
| **Plop Generator** | `plop-helpers/apiV2Wiring.mjs` & test | `[MODIFY]` | Trỏ `API_V2_WIRING_FILES.rbacResource` sang `src/v2/core/rbac/enums/erp-resource.enum.ts` |
| **Plop Templates** | `plop-templates/workflow-common/`, `module-v2/`, `voucher-v2/` | `[MODIFY]` | Đổi import sang `@/v2/core/rbac` |
| **API Callers** | Toàn bộ 75+ controllers, decorators, services trong `src/` | `[MODIFY]` | Đổi import từ `@/rbac-core/enums` và `@/rbac-core` sang `@/v2/core/rbac` |
| **API Dọn dẹp** | `src/rbac-core/` | `[DELETE]` | Đã xóa sạch 100% thư mục `src/rbac-core` |
| **Tài liệu & Skill** | `.agents/skills/modules/rbac-core/SKILL.md` | `[MODIFY]` | Cập nhật sơ đồ kiến trúc và đường dẫn enums |
| **Tài liệu & Skill** | `.agents/skills/erp-api-structure/` & workflows | `[MODIFY]` | Cập nhật đường dẫn enums chuẩn V2 |

---

## 🧪 Bằng chứng xác thực (Verification Evidence)

1. **Type Checking toàn dự án**:
   ```bash
   cd erp/erp-api && bunx tsc --noEmit
   ```
   ➔ **PASS (0 errors)**

2. **Unit Tests RBAC Core & Module `rbac-roles` (Jest)**:
   ```bash
   cd erp/erp-api && bunx jest src/v2/core/rbac/ src/v2/modules/rbac-roles/
   ```
   ➔ **PASS: 5 Test Suites, 46 Tests Passed (100%)**
   - `rbac-role.mapper.spec.ts` (PASS)
   - `rbac-core.service.spec.ts` (PASS)
   - `rbac-roles.service.spec.ts` (PASS)
   - `rbac-roles.contract.spec.ts` (PASS)
   - `rbac-roles.http.spec.ts` (PASS)

3. **Plop Generator Helper Test**:
   ```bash
   cd erp/erp-api && bun test plop-helpers/apiV2Wiring.test.mjs
   ```
   ➔ **PASS: 6 tests across 1 file (100%)**

4. **Kiểm tra không còn bất kỳ import nào trỏ tới `rbac-core`**:
   ```bash
   grep -rn "@/rbac-core" src/
   ```
   ➔ **Không có kết quả nào (Empty)**

---

## 🧠 Tri thức & Skill đồng bộ

- **Module Skill**: Đã cập nhật `erp/erp-api/.agents/skills/modules/rbac-core/SKILL.md`.
- **References**: Đã cập nhật `erp/erp-api/.agents/skills/erp-api-structure/references/v2-module.md`.
- **Plane Tracking**: Story **KINDU-349** và các Tasks **KINDU-350** đến **KINDU-354** đã được cập nhật hoàn thành trên Plane (project KINDU, workspace k-industries).
