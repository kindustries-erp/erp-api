---
name: notifications-v2
description: Module backend thông báo theo user (v2) tại /api/v2/notifications, bảng notifications_core, chạy song song v1 /notifications. Không RBAC; mỗi user chỉ thấy thông báo của chính mình.
---

# 🔔 Module Backend Tri Thức: Notifications v2 (`notifications-v2`)

## 1. Tổng quan & trách nhiệm
- **Endpoint** (prefix `/api/v2/notifications`, `JwtAuthGuard`, không `RequirePermissions`):
  - `GET /` danh sách phân trang, lọc `unreadOnly`, `type`
  - `GET /unread-count`
  - `PATCH /read-all`
  - `PATCH /:id/read`
  - `DELETE /all` (xóa mềm tất cả)
  - `DELETE /:id` (xóa mềm một dòng)
- **Lõi**: `NotificationsCoreModule` (`src/v2/core/notifications-core/`), gồm entity `NotificationCore`, `NotificationQueryService`, `NotificationCommandService`, `NotificationsCoreService` (điểm gọi cho producer).
- **Module HTTP**: `NotificationsV2Module` (`src/v2/modules/notifications/`), gồm `NotificationController`, facade `NotificationsV2Service`, DTO, mapper.
- **Bảng**: `notifications_core` (migration `src/migrations/20261109120000-create-notifications-core.ts`). Không dùng chung với `core_notifications` của v1.

## 2. Hợp đồng dữ liệu
| Cột | Kiểu | Ghi chú |
| :--- | :--- | :--- |
| `id` | uuid | PK |
| `user_id` | uuid NOT NULL | FK `core_users` ON DELETE CASCADE. Mỗi dòng thuộc đúng một user |
| `title` / `message` | varchar(255) / text | |
| `type` | varchar(20), mặc định `INFO` | `INFO`, `WARNING`, `ERROR`, `SUCCESS` |
| `is_read` / `read_at` | bool / timestamptz null | |
| `extra_data` | jsonb `{}` | Dùng cho i18n key/params, thay `metadata` của v1 |
| `target_module` | varchar(50) null | Chứng từ/màn hình liên quan, ví dụ `INVOICE`, `PROCUREMENT_ORDER_GARAGE`. FE ánh xạ sang drawer/modal |
| `target_id` | varchar(100) null | Id hoặc mã chứng từ. Là varchar vì có chứng từ dùng uuid, có chứng từ dùng mã |
| `action` | varchar(30) null | `VIEW`, `APPROVE`, `REJECT` |
| `is_deleted`, `created_at`, `updated_at` | | Từ `CoreSoftDeletableEntity` |

Index: `IDX_notifications_core_user_list` trên `(user_id, is_deleted, is_read, created_at DESC)`.

Response list: `{ items, pagination: { page, pageSize, total, totalPages }, unreadCount }`.

Mỗi item có `target: { module, id, action } | null`. `null` khi thông báo không gắn chứng từ.

## 2b. Bấm thông báo (deep link)
- FE giữ bảng ánh xạ `(target_module, action)` → drawer/modal. DB không lưu tên component.
- Mở chứng từ chỉ là mở màn hình. Dữ liệu vẫn qua API của module đó và chịu RBAC như bình thường. Thông báo không cấp thêm quyền.
- Chứng từ đã xóa hoặc đổi: API trả 404, FE hiển thị "chứng từ không còn tồn tại" và không tự đánh dấu đã đọc.
- Producer truyền đích qua `payload.target = { module, id, action }`. Thao tác đơn và hàng loạt: `{ message, data }`, với `data` là `null` hoặc `{ affected }`.

## 3. Quy tắc bảo mật và sở hữu
- Mọi truy vấn và cập nhật đều lọc `user_id = :sub` lấy từ JWT. Client không truyền được `userId`.
- Id thuộc user khác, hoặc đã xóa mềm, trả **404** (không lộ sự tồn tại).
- Không có RBAC. Quyền duy nhất là đăng nhập và thao tác trên thông báo của chính mình.

## 4. Cách producer ghi thông báo
```ts
import { NotificationsCoreModule, NotificationsCoreService } from '@/v2/core/notifications-core';

// imports: [NotificationsCoreModule]
await this.notificationsCore.createForUsers(userIds, {
  title: '...',
  message: '...',
  type: 'WARNING',
  extraData: { i18nTitleKey: '...' },
});
```
- Lỗi ghi bị nuốt và log, không làm hỏng luồng gọi (đúng hành vi v1).
- Producer tự resolve danh sách `userIds`. Lõi không biết role hay chi nhánh.

## 5. Ràng buộc đã biết
- Đã chuyển sang v2 (13 chỗ gọi, 5 file): `erp-invoices-core` (controller, cron, invoice-portal), `sinvoice-cron`, `kgara-sync.scheduler`. Mọi producer dùng `NotificationsCoreService`.
- Module v1 `NotificationsModule` và bảng `core_notifications` còn nguyên cho Web cũ chưa deploy. Gỡ v1 là task riêng.
- Web (`erp-web` `@/core/api/notifications`) đã gọi `/api/v2/notifications`. `findAll` lấy `items` với `pageSize=50`. Chưa dùng `unreadCount` của API (3 consumer còn tự đếm).
- Chưa có realtime (SSE/WebSocket). Web chỉ polling hoặc refetch.

## 6. Co-located tests
- `src/v2/core/notifications-core/services/notification-query.service.spec.ts`
- `src/v2/core/notifications-core/services/notification-command.service.spec.ts`
- `src/v2/core/notifications-core/services/notifications-core.service.spec.ts`
- `src/v2/modules/notifications/helpers/notification.mapper.spec.ts`
- `src/v2/modules/notifications/notifications.service.spec.ts`
- `src/v2/modules/notifications/notifications.module.di.spec.ts`
- `src/v2/modules/notifications/controllers/notification.routes.spec.ts`

Lệnh: `bunx jest src/v2/core/notifications-core src/v2/modules/notifications --forceExit`.

## 7. Liên kết
- Plan: `/home/lio/.claude/plans/anh-mu-n-t-o-api-v2-notification-glistening-reddy.md`
- Quy tắc tên bảng: `.agents/workflows/api-structure.md` mục "Quy tắc đặt tên bảng (v2)".
