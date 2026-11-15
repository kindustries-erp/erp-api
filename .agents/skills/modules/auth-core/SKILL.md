---
name: auth-core
description: Lõi base (v2) cho phiên đăng nhập tại src/v2/core/auth-core. Chỉ base, không có @Entity/@Controller/@Cron. Gồm BaseAuthSessionEntity, AbstractAuthSessionService (phát hành, xoay vòng, thu hồi, phát hiện dùng lại refresh token), helper token và hằng số. Module cụ thể là auth-sessions.
---

# Lõi `auth-core` (backend)

Manifest `core.manifest.json` style `v2-core`, import qua barrel `@/v2/core/auth-core`.

| Thành phần | Nội dung |
| :--- | :--- |
| `BaseAuthSessionEntity` | Kế thừa `CoreSoftDeletableEntity`. Cột `user_id`, `token_hash`, `expires_at`, `revoked_at`, `user_agent`, `ip_address` (mọi cột thời gian `timestamptz`). Lớp con khai báo `@Entity`, index và FK. |
| `AbstractAuthSessionService<T>` | Nhận `Repository<T>`. `issue`, `findValid`, `rotate`, `revoke`, `revokeAllForUser`, `purgeExpiredBefore`. |
| Helper | `hashToken` (SHA-256 hex, trùng hash v1), `generateRefreshToken` (48 byte, 96 hex), `parseExpiresInSeconds` ('8h', '30d', '3600'). |
| Hằng số | `REFRESH_TOKEN_LIFETIME_SECONDS` (30 ngày), `DEFAULT_ACCESS_TOKEN_SECONDS` (8 giờ), `TOKEN_TYPE_BEARER`. |

Quy tắc bảo mật đã mã hóa trong lõi:
- Chỉ lưu hash của token, không bao giờ lưu token thô.
- `findValid`: token đã thu hồi mà bị gửi lên là dấu hiệu đánh cắp, thu hồi mọi phiên của user và trả null; token hết hạn trả null, không thu hồi hàng loạt.
- `rotate`: thu hồi có điều kiện `revoked_at IS NULL` và kiểm `affected`; hai request đồng thời cùng một token chỉ một request thắng, request thua nhận null (401), không thu hồi hàng loạt.

Kiểm thử: `bunx jest src/v2/core/auth-core`. Module dùng lõi này: `auth-sessions`.
