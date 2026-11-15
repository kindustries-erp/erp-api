---
name: auth-sessions
description: Module backend Auth V2 tại /api/v2/auth-sessions (login, refresh, logout, impersonate, change-password, profile). Người dùng từ users_management, phiên trên bảng auth_sessions, JWT dùng chung với v1. Chạy song song /api/v1/auth. Đọc khi sửa đăng nhập, phiên, đổi mật khẩu hoặc luồng v1 gọi sang UsersAuthService.
---

# Module `auth-sessions` (Auth V2, backend)

Vị trí: `src/v2/modules/auth-sessions/` (module `AuthSessionsModule`, đã nối `app.module.ts` và `db/data-source.ts`). Lõi base: skill `auth-core`. Bảng: `auth_sessions`.

## 1. Endpoint (`/api/v2/auth-sessions`)

| Endpoint | Guard | Ghi chú |
| :--- | :--- | :--- |
| `POST /login` | Công khai | `{ email, password }` -> 200 `{ message, data: { accessToken, refreshToken, expiresIn, tokenType, user, preferences } }`. Sai email hoặc mật khẩu: 401 cùng thông báo; tài khoản không `ACTIVE`: 401. |
| `POST /refresh` | Công khai | `{ refreshToken }` -> `{ accessToken, refreshToken, expiresIn, tokenType }` (camelCase, khác v1 trộn `access_token`). Xoay vòng; dùng lại token đã thu hồi: 401 và thu hồi mọi phiên của user. |
| `POST /logout` | Công khai | `{ refreshToken }` thu hồi phiên. |
| `POST /impersonate` | JWT | `{ targetUserId }`; chỉ `admin@liouni.com`. JWT mang thêm `impersonatorId`. |
| `POST /change-password` | JWT | `{ oldPassword, newPassword }` (mới 8-72 ký tự); thu hồi mọi phiên (`auth_sessions` và `core_refresh_tokens`). |
| `GET /profile` | JWT | user, nhân viên, quyền, preferences. |
| `PATCH /profile` | JWT | `{ email?, fullName?, phone?, notes? }`; 409 trùng email, 400 khi gửi trường nhân viên mà chưa liên kết nhân viên. |

Mọi response `{ message, data }`, không bao giờ có `passwordHash`. Login, refresh, logout công khai có chủ ý (ghi trên controller). Chưa có rate-limit đăng nhập (nợ chung của repo, xem `security-baseline.md` mục 3).

## 2. Thành phần

- `AuthSessionsService` (facade), `AuthSessionsController`.
- `AuthLoginService` (login, refresh, logout, impersonate), `AuthProfileService` (profile, cập nhật, đổi mật khẩu).
- `SessionTokenService extends AbstractAuthSessionService<AuthSession>` (repo `auth_sessions`).
- `AuthSessionCleanupJob extends ScheduledJob`: 03:00 mỗi ngày (giờ VN) xóa cứng phiên đã hết hạn; phiên thu hồi nhưng chưa hết hạn giữ lại để phát hiện dùng lại token.
- `LegacyRefreshTokenExchange` (TẠM, xóa khi bỏ v1): refresh bằng refresh token v1 còn hạn được đổi một lần sang phiên v2 để người đang đăng nhập không bị văng.
- JWT dùng chung secret và payload `{ sub, email, status }` với v1 qua `AuthModule` (`JwtStrategy`, `JwtAuthGuard`, RBAC không đổi).

## 3. Nguồn dữ liệu người dùng

`users_management` là nguồn chính. Thao tác tài khoản của auth đi qua `UsersAuthService` (module `users-management`): khóa hàng `pessimistic_write`, ghi `users_management` rồi mirror sang `core_users` trong CÙNG transaction (chỉ `core_notifications` và `core_refresh_tokens` còn FK trỏ `core_users`; `rbac_user_roles`, `table_preferences`, `notifications_inbox`, `auth_sessions` đã trỏ `users_management`). `lastLoginAt` ghi đúng một chỗ (`recordLogin`).

v1 giữ nguyên hợp đồng nhưng dùng cùng service: `AuthService` (`/api/v1/auth/*`) dùng `UsersAuthService`; `register` ủy quyền `UsersManagementService.create`; `UsersAdminService` (`/api/v1/admin/users`, đã tắt mặc định) ủy quyền mọi thao tác ghi sang `UsersManagementService` (đọc vẫn từ bản sao `core_users`).

## 4. Migration

- `20261115110000-create-auth-sessions`: bảng, FK `user_id` -> `users_management(id)` ON DELETE CASCADE, unique `token_hash`, index `user_id`, `expires_at`.
- `20261115110100-reconcile-users-management`: đối chiếu cuối `core_users` -> `users_management` (thay cho cơ chế kéo ở mỗi lần đọc/ghi đã bỏ); báo lỗi và liệt kê id nếu còn lệch. `down()` không làm gì.

## 5. Kiểm thử

- Unit: `bunx jest src/v2/modules/auth-sessions src/v2/core/auth-core src/auth src/users-admin src/v2/modules/users-management`.
- Smoke (API đang chạy, chỉ staging/dev): `bun run test:smoke:auth-sessions` (cần `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`; impersonate chỉ chạy khi admin là `admin@liouni.com`). Dọn `smoke-auth-<tag>-*` bằng SQL.

## 5b. Ngắt V1 auth bằng cờ `ENABLE_V1_AUTH_TOKENS` (mặc định tắt)

- `/api/v1/auth/login`, `/refresh`, `/impersonate` trả 410 trừ khi `ENABLE_V1_AUTH_TOKENS=true`. Lùi: đặt cờ và khởi động lại API. Không đổi DB, không xóa gì.
- Token V1 tạo trước vẫn đổi được qua `/api/v2/auth-sessions/refresh` (`LegacyRefreshTokenExchange`, giữ đến khi token V1 hết hạn, muộn nhất 2026-12-15).
- **Checklist deploy**: (1) kiểm log Nginx/Komodo xem còn client ngoài web gọi `/api/v1/auth/login` không; (2) deploy API và web mới **cùng một đợt** (API trước web thì web cũ mất đăng nhập); (3) theo dõi `SELECT max(created_at) FROM core_refresh_tokens` ngừng tăng.
- Test: smoke `auth-sessions` chạy được cả hai trạng thái cờ (46/46 tắt, 50/50 bật, staging 2026-11-15). Khoảng 12 script smoke/E2E khác còn đăng nhập V1 sẽ nhận 410: đặt `ENABLE_V1_AUTH_TOKENS=true` trong `.env` local khi chạy chúng, hoặc chuyển sang login V2.
- E2E `users-management` dùng login V2. Bước E2 có thể rớt do lệch thời điểm bắt response (`v2+0`); chạy lại là đạt.

## 6. Việc còn lại (đợt riêng, theo lệnh)

Đã chuyển FK sang `users_management` cho `rbac_user_roles`, `table_preferences`, `notifications_inbox` (migration `20261115120000`-`20261115120200`). Còn lại: bỏ v1 (`core_refresh_tokens`, `core_notifications`) rồi xóa mirror `core_users`, `LegacyRefreshTokenExchange`, `UsersService` v1 và v1 auth.
