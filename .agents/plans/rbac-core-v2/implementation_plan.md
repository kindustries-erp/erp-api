# Plan: Migrate `rbac-core` sang v2 (lõi + module)

Phạm vi: `erp/erp-api` (branch `erp-master`). Không đổi `erp-web`.
Chuẩn: `/api-structure` Phần B, sinh khung bằng plop (`api-core` + `api-thin-module`), chỉnh tay phần nghiệp vụ.

## Mục tiêu

- Tách `src/rbac-core/` (v1, `rbac-core.service.ts` 564 dòng) thành:
  - Lõi `src/v2/core/rbac/`: 3 entity, `RbacCoreService` (5 method kiểm quyền dùng chung), helper thuần `permission-match`, module `@Global`.
  - Module `src/v2/modules/rbac-roles/`: controller giữ route `/api/v1/rbac-core`, facade `RbacRolesService`, 4 sub-service, mapper, response DTO.
- `src/rbac-core/enums/` giữ nguyên (đã chốt).
- UI không đổi: 9 endpoint, method, RBAC `ADMIN_USERS/MANAGE`, shape response giữ như v1.

## Ngoài phạm vi

Enums, guard/decorator trong `src/auth/`, `erp-web`, migration DB, thay đổi nghiệp vụ.

## Quyết định

- `GET roles/:roleId/users` chỉ trả `{id, email}` (v1 lộ `password_hash`).
- Thêm `ParseUUIDPipe` cho mọi tham số id/roleId: UUID sai trả 400 thay vì 500.
- Bỏ `is_deleted` của khung plop (bảng `core_roles` không có cột này). Xóa role là xóa cứng như v1.
- Không bọc transaction cho cập nhật quyền/người dùng của role (giữ hành vi v1). Chờ anh quyết nếu muốn bọc.

## Tiêu chí chấp nhận

| AC | Nội dung | Cách kiểm |
| :--- | :--- | :--- |
| AC-1 | 9 route giữ path, method, RBAC như v1 | `rbac-roles.contract.spec.ts` |
| AC-2 | Shape response khớp v1 (`{permissions}`, `{users}`, `{resources}`, `{success:true}`, list có `is_active`) | contract spec |
| AC-3 | Kiểm quyền bất biến (wildcard `*`, `SUPER_ADMIN`, `ALL`, chỉ role đang active) | `bunx jest src/v2/core/rbac` |
| AC-4 | Controller/facade không trả entity | contract spec + grep |
| AC-5 | Cấu trúc đạt chuẩn, controller ≤300 dòng, service ≤500 dòng | `scan-oversized-files.ts --strict` |
| AC-6 | Build ra `dist/main.js`, type:check, check:ci, CI xanh | build, CI trên `erp-master` |
| AC-7 | Không sửa `erp-web` | `git -C erp/erp-web status --short` rỗng |

## Thứ tự thực hiện (đã làm)

1. Spec hợp đồng baseline trên v1, lưu bản gốc v1 ra scratchpad.
2. Sinh khung core và module bằng plop, bỏ `is_deleted`, viết lại manifest.
3. Hoàn thiện lõi: 3 entity, `RbacCoreService`, helper, spec.
4. Helper, mapper, response DTO, sub-service, facade, controller, spec co-located.
5. Nối lại import (`app.module.ts`, `data-source.ts`, auth, guard, seed, sinvoice, v2 procurement...), xóa v1 trừ `enums/`.
6. Sửa lỗi 500 với UUID sai (`ParseUUIDPipe`), thêm `rbac-roles.http.spec.ts`.
7. Smoke test staging bằng role `[TEST]` tạm: tạo, sửa, gán quyền, gán user, xóa. Không còn dữ liệu thừa.
8. Commit `c37a14c`, `e43adb0`, `be2c798` trên `erp-master`; push; CI xanh.

## Rollback

Chỉ đổi code, không có migration. Revert các commit `c37a14c`, `e43adb0`, `be2c798` theo thứ tự ngược. Bản gốc v1 nằm trong scratchpad của phiên làm việc.

## Theo dõi

Plane KINDU: 3.1.2 (KINDU-336) và 3.1.3 (KINDU-337) đã Completed. 3.2.1 (KINDU-338) hoàn tất sau khi cập nhật `SKILL.md`, bảng 5b và tạo bộ tài liệu này.
