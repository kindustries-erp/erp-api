---
name: notifications-inbox
description: Module backend thông báo theo user (v2) tại /api/v2/notifications-inbox, bảng notifications_inbox, chạy song song v1 /notifications. Không RBAC; mỗi user chỉ thấy thông báo của chính mình. Base dùng chung nằm ở lõi notifications-core.
---

# 🔔 Module Backend Tri Thức: Notifications Inbox (`notifications-inbox`)

## 1. Tổng quan & trách nhiệm
- **Endpoint** (prefix `/api/v2/notifications-inbox`, `JwtAuthGuard`, không `RequirePermissions`):
  - `GET /` danh sách phân trang, lọc `unreadOnly`, `type`
  - `GET /unread-count`
  - `PATCH /read-all`
  - `PATCH /:id/read`
  - `DELETE /all` (xóa mềm tất cả)
  - `DELETE /:id` (xóa mềm một dòng)
- **Lõi base** (chỉ base, không có entity cụ thể, controller hay job): `src/v2/core/notifications-core/`
  - `BaseNotificationEntity` (abstract): các cột thông báo, kế thừa `CoreSoftDeletableEntity`.
  - `AbstractNotificationQueryService<T>` và `AbstractNotificationCommandService<T>`: logic lọc theo user, xóa mềm, xóa cứng theo lô. Nhận `Repository<T>` qua constructor.
  - `NOTIFICATION_TYPES` và các type payload.
- **Module** `NotificationsInboxModule` (`src/v2/modules/notifications-inbox/`), gồm:
  - `NotificationInbox` (`@Entity('notifications_inbox')`, kế thừa `BaseNotificationEntity`).
  - `NotificationInboxQueryService`, `NotificationInboxCommandService`: kế thừa abstract, tiêm `@InjectRepository(NotificationInbox)`.
  - `NotificationsPublisherService`: điểm gọi cho producer (nuốt lỗi và log).
  - `NotificationPurgeJob`: kế thừa `ScheduledJob`, xem mục 3b.
  - `NotificationController`, facade `NotificationsInboxService`, DTO, mapper.
- **Bảng**: `notifications_inbox`. Đổi từ `notifications_core` bằng migration `src/migrations/20261109150000-rename-notifications-core-to-inbox.ts` (có `down()`). Không dùng chung với `core_notifications` của v1.

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

Index: `IDX_notifications_inbox_user_list` trên `(user_id, is_deleted, is_read, created_at DESC)`.

Response list: `{ items, pagination: { page, pageSize, total, totalPages, next, previous }, extraData: { unreadCount } }` (`unreadCount` nằm trong `extraData`, không còn ở gốc; dựng bằng `toPagedList(..., { unreadCount })`).

Mỗi item có `target: { module, id, action } | null`. `null` khi thông báo không gắn chứng từ.

## 2b. Bấm thông báo (deep link)
- FE giữ bảng ánh xạ `(target_module, action)` → drawer/modal. DB không lưu tên component.
- Mở chứng từ chỉ là mở màn hình. Dữ liệu vẫn qua API của module đó và chịu RBAC như bình thường. Thông báo không cấp thêm quyền.
- Chứng từ đã xóa hoặc đổi: API trả 404, FE hiển thị "chứng từ không còn tồn tại" và không tự đánh dấu đã đọc.
- Producer truyền đích qua `payload.target = { module, id, action }`. Đích đang dùng: `PROCUREMENT_REQUEST_GARAGE` (đề nghị garage; `APPROVE` = mở modal duyệt, `VIEW` = mở drawer xem). Thao tác đơn và hàng loạt: `{ message, data }`, với `data` là `null` hoặc `{ affected }`.

## 3. Quy tắc bảo mật và sở hữu
- Mọi truy vấn và cập nhật đều lọc `user_id = :sub` lấy từ JWT. Client không truyền được `userId`.
- Id thuộc user khác, hoặc đã xóa mềm, trả **404** (không lộ sự tồn tại).
- Không có RBAC. Quyền duy nhất là đăng nhập và thao tác trên thông báo của chính mình.

## 3b. Xóa cứng định kỳ (job `notifications-purge`)
- `NotificationPurgeJob` (`src/v2/modules/notifications-inbox/jobs/notification-purge.job.ts`) kế thừa `ScheduledJob`. Được đăng ký tự động bởi `SchedulerJobsModule` (xem skill `scheduler-jobs`).
- Lịch: `0 30 2 * * *`, múi giờ `Asia/Ho_Chi_Minh`.
- Điều kiện xóa: `is_deleted = true AND updated_at < now - N ngày`. Dòng chưa xóa mềm không bị đụng tới. `updated_at` là mốc xóa mềm vì TypeORM ghi lại khi `update()`.
- Tên bảng lấy từ `repo.metadata.tableName`, không hard-code.
- Xóa theo lô 1000 dòng (`PURGE_BATCH_SIZE`), lặp đến khi lô cuối nhỏ hơn 1000.
- Số ngày `N`: env `NOTIFICATION_PURGE_RETENTION_DAYS`, mặc định 90. Giá trị thiếu hoặc không phải số nguyên dương thì dùng 90.
- Bật/tắt theo `isCronEnabled()`: `ENABLE_CRON=true` bật, `false` tắt, không đặt thì chỉ bật ở môi trường production.
- Xóa cứng không hoàn tác được. Muốn khôi phục phải có backup DB.

## 4. Cách producer ghi thông báo
```ts
import { NotificationsInboxModule, NotificationsPublisherService } from '@/v2/modules/notifications-inbox';

// imports: [NotificationsInboxModule]
await this.notificationsPublisher.createForUsers(userIds, {
  title: '...',
  message: '...',
  type: 'WARNING',
  extraData: { i18nTitleKey: '...' },
});
```
- Lỗi ghi bị nuốt và log, không làm hỏng luồng gọi (đúng hành vi v1).
- Producer tự resolve danh sách `userIds`. Module không biết role hay chi nhánh.

## 5. Ràng buộc đã biết
- Đã chuyển sang v2: `erp-invoices-core` (controller, cron, invoice-portal), `sinvoice-cron`, `kgara-sync.scheduler`. Mọi producer dùng `NotificationsPublisherService` (`/usr/bin/grep -rn NotificationsPublisherService src` để xem danh sách).
- Module v1 `NotificationsModule` và bảng `core_notifications` còn nguyên cho Web cũ chưa deploy. Gỡ v1 là task riêng.
- Web (`erp-web` `@/core/api/notifications`) đã gọi `/api/v2/notifications-inbox`. `findAll` lấy `items` với `pageSize=50`. Chưa dùng `unreadCount` của API (3 consumer còn tự đếm).
- Chưa có realtime (SSE/WebSocket). Web chỉ polling hoặc refetch.
- Đổi tên bảng đã chạy trên staging chỉ sau khi có lệnh riêng. Tiến trình API đang chạy phải khởi động lại sau khi migrate.

## 6. Co-located tests
- Lõi: `src/v2/core/notifications-core/` (chỉ base, không có spec riêng).
- Module `src/v2/modules/notifications-inbox/`:
  - `services/notification-inbox-query.service` — truy vấn theo user (spec `notification-inbox-query.service.spec.ts`)
  - `services/notification-inbox-command.service.spec.ts` — ghi, đọc, xóa mềm, cô lập theo user
  - `services/notification-inbox-command.service.purge.spec.ts` — xóa cứng theo lô
  - `services/notifications-publisher.service.spec.ts` — nuốt lỗi producer
  - `jobs/notification-purge.job.spec.ts` — retention và cutoff
  - `jobs/notification-purge.di.spec.ts` — job được discovery, cổng `ENABLE_CRON`
  - `controllers/notification.routes.spec.ts`, `helpers/notification.mapper.spec.ts`, `notifications-inbox.service.spec.ts`, `notifications-inbox.module.di.spec.ts`

Lệnh: `bunx jest src/v2/modules/notifications-inbox src/v2/modules/scheduler-jobs --forceExit`.
Kiểm tra bố cục lõi: `bun test plop-helpers/apiCoreLayout.test.mjs`.

## 7. Liên kết
- Plan: `/home/lio/.claude/plans/anh-mu-n-t-o-api-v2-notification-glistening-reddy.md`
- Quy tắc tên bảng và lõi/module: `.agents/workflows/api-structure.md` Phần B.
