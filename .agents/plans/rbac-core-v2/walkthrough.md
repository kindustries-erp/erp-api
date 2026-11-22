# Walkthrough: Migrate `rbac-core` sang v2

## Kết quả

- Lõi `src/v2/core/rbac/`: 3 entity giữ tên class và bảng `core_roles` / `core_permissions` / `core_user_roles`. `RbacCoreService` giữ 5 method kiểm quyền và chữ ký cũ. `RbacCoreModule` là `@Global`.
- Module `src/v2/modules/rbac-roles/`: controller `@Controller('rbac-core')`, facade `RbacRolesService` cộng 4 sub-service (`role-query`, `role-command`, `role-permissions`, `role-users`), mapper, response DTO.
- Route `/api/v1/rbac-core/...` không đổi. `erp-web` không sửa.
- `src/rbac-core/` chỉ còn `enums/` và `index.ts` re-export enums.
- `GET roles/:roleId/users` trả `{id, email}`, không còn `password_hash`.
- Mọi `:id` / `:roleId` được validate UUID (400). Trước đây PostgreSQL ném lỗi và thành 500.

## Commit trên `erp-master`

| Commit | Nội dung |
| :--- | :--- |
| `c37a14c` | refactor(rbac-core): migrate RBAC sang v2 (core rbac + module rbac-roles) |
| `e43adb0` | fix(rbac-roles): validate UUID cho tham số id/roleId (400 thay vì 500) |
| `be2c798` | docs(rbac-core): cập nhật SKILL theo kiến trúc v2 |

Đã push `e56d4a9..be2c798`. CI trên `be2c798` xanh (theo anh xác nhận).

## Bằng chứng kiểm thử

- `bun run type:check`: PASS (lần chạy trước khi push, exit 0).
- Jest scope rbac: `src/v2/core/rbac` (kiểm quyền), `src/v2/modules/rbac-roles` (contract, HTTP UUID, facade, mapper, sub-service).
- Smoke staging: role `[TEST]` tạo, sửa, gán quyền, gán user, xóa. Đã xác nhận không còn dữ liệu thừa.
- CI GitHub: check, test, build xanh trên `be2c798`.

## Ghi chú

- Lần đầu chạy `/api/v2/rbac-core/roles` trả 404. Đây là hành vi đúng: module chỉ mount v1.
- Tạo role trùng tên chưa kiểm thử, hành vi giữ như v1.
- Xóa role là xóa cứng, giữ như v1, vì `core_roles` không có `isDeleted`.
- Cập nhật quyền/người dùng của role không có transaction, giữ như v1.
