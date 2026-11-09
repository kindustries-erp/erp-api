---
name: job-scheduler
description: Module v2 điều phối job định kỳ (cron) với một cổng ENABLE_CRON duy nhất, chống chạy chồng, cô lập lỗi và đo trạng thái. Tự tìm các job kế thừa ScheduledJob. Dùng cho mọi cron mới trong erp-api.
---

# ⏱️ Module Backend Tri Thức: Job Scheduler (`job-scheduler`)

## 1. Tổng quan & trách nhiệm
- **Module**: `JobSchedulerModule` (`src/v2/modules/job-scheduler/`). Import một lần trong `AppModule`. Không có entity, controller hay endpoint.
- **Thành phần**:
  - `JobSchedulerService`: khi khởi động, dùng `DiscoveryService` tìm mọi provider là `ScheduledJob` và đăng ký. Có `register(def)`, `getStatus()`, `onApplicationBootstrap`, `onModuleDestroy`.
- **Lớp nền** (lõi, chỉ base): `src/v2/core/scheduler-core/`
  - `ScheduledJob` (abstract, `jobs/scheduled-job.ts`): khai báo `jobName`, `cron`, `timeZone` (mặc định `Asia/Ho_Chi_Minh`) và `run()`.
  - `types/scheduler.types.ts`: `ScheduledJobDefinition`, `JobStatus`, `DEFAULT_JOB_TIMEZONE`.
- **Tái dùng**: `isCronEnabled()` và `runSafeCronJob()` từ `src/common/utils/cron.util.ts`. `SchedulerRegistry` từ `ScheduleModule.forRoot()` (global).

## 2. Hợp đồng để viết job mới
```ts
import { Injectable } from '@nestjs/common';
import { ScheduledJob } from '@/v2/core/scheduler-core';

@Injectable()
export class TenJobPurge extends ScheduledJob {
  readonly jobName = 'ten-job-duy-nhat';   // không trùng trong toàn hệ thống
  readonly cron = '0 30 2 * * *';          // 6 trường, có giây
  readonly timeZone = 'Asia/Ho_Chi_Minh';  // tùy chọn

  async run(): Promise<void> {
    // logic nằm ở service của module
  }
}
```
- Đăng ký job bằng cách khai báo nó là provider trong một module v2 (ví dụ `notifications-inbox`). Không cần tiêm scheduler.
- Trùng `jobName` thì ném lỗi `Job "..." đã được đăng ký` khi khởi động.

## 3. Quy tắc vận hành
- **Cổng duy nhất**: `isCronEnabled()`. `ENABLE_CRON=true` bật, `false` tắt, không đặt thì chỉ bật ở production (`APP_ENV` kết thúc `-production` hoặc `NODE_ENV=production`).
- Khi tắt, không tạo `CronJob` nào. `getStatus()` vẫn liệt kê job với `enabled: false`.
- **Không chạy chồng**: nếu chu kỳ trước còn chạy, chu kỳ mới bị bỏ qua và ghi cảnh báo.
- **Cô lập lỗi**: lỗi một job được log qua `runSafeCronJob`, không ảnh hưởng job khác.
- **Trạng thái trong bộ nhớ**: `lastRunAt`, `lastSuccess`, `lastDurationMs`, `running` reset khi process khởi động lại. Không có bảng lịch sử.
- **Đóng module**: `onModuleDestroy` gỡ các job đã bật khỏi `SchedulerRegistry`.

## 4. Quy tắc cho cron mới (bắt buộc)
- Cron mới trong erp-api là class kế thừa `ScheduledJob`, nằm trong module. **Không** thêm `@Cron(...)` hay `setInterval` mới để chạy nền.
- Logic job nằm trong service của module. `run()` chỉ gọi service đó.
- Job phải idempotent hoặc an toàn khi lặp, vì nhiều instance có thể cùng chạy (chưa có khóa phân tán).

## 5. Các job đang dùng
| Job | Module | Lịch | Biến môi trường |
| :--- | :--- | :--- | :--- |
| `notifications-purge` | `notifications-inbox` | `0 30 2 * * *` (Asia/Ho_Chi_Minh) | `NOTIFICATION_PURGE_RETENTION_DAYS` (mặc định 90) |

**Chưa chuyển sang job-scheduler** (vẫn dùng cơ chế cũ, đang chạy theo cổng riêng): `auth.service` (`@Cron` dọn refresh token, không có cổng), `audit-retention.scheduler` (`@Cron` 02:00, cổng `ENABLE_AUDIT_LOG`), `kgara-sync.scheduler`, `erp-invoices-cron.service`, `sinvoice-cron.service`, `goods-receipts-cron.service`. Chuyển là task riêng, cần lệnh của người dùng.

## 6. Co-located tests
- `src/v2/modules/job-scheduler/services/job-scheduler.service.spec.ts` (gồm test tự phát hiện `ScheduledJob`, trùng `jobName`)
- `src/v2/modules/notifications-inbox/jobs/notification-purge.di.spec.ts` (discovery thật, cổng `ENABLE_CRON`)

Lệnh: `bunx jest src/v2/modules/job-scheduler src/v2/modules/notifications-inbox/jobs --forceExit`.

## 7. Liên kết
- Plan: `/home/lio/.claude/plans/anh-mu-n-t-o-api-v2-notification-glistening-reddy.md`
- Quy tắc cấu trúc: `.agents/workflows/api-structure.md` Phần B.
