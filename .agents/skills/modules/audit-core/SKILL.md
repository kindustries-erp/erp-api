---
name: audit-core
description: Module tri thức Nhật ký Kiểm toán Hệ thống (Audit Logs & Zero-Trust Tracking) trong erp-api (audit-core). Chứa toàn bộ database schema (audit_logs, v2), composite indexes, DTOs, API endpoints, logic Async Batch Buffering, Payload Sanitizer, Retention ScheduledJob và tích hợp liên module với payment-vouchers, cashflow-vouchers & frontend activity timelines.
---

# 🛡️ Module Tri Thức: Audit Core & System Activity Tracking - Backend (`erp-api`)

> **Trạng thái v2 (2026-11-15)**: ghi + đọc đã chuyển sang `src/v2/core/audit-core/` (base: types, sanitizer, `buildAuditDiff`, `AbstractAuditWriterService`) và `src/v2/modules/audit-logs/` (route `/api/v2/audit-logs`, bảng **`audit_logs`**). V1 `src/audit-core` chỉ còn lớp ủy quyền mỏng giữ chữ ký/route cũ (`/api/v1/audit-logs-core`), dùng **một** bộ đệm ghi duy nhất của v2. Web `auditCoreApi` gọi `/api/v2/audit-logs` (client `erp-web/src/v2/modules/audit-logs/api/auditLogsV2Api.ts`). Bảng cũ `erp_audit_logs` giữ nguyên làm bản lưu, không còn được ghi. Các mục 2-5 bên dưới mô tả v1 gốc; **mục 8 là hiện trạng v2 và có hiệu lực khi mâu thuẫn**.

## 1. Tổng quan Nghiệp vụ

Module `audit-core` chịu trách nhiệm ghi nhận, lập chỉ mục và cung cấp dữ liệu nhật ký kiểm toán (Audit Logs) toàn diện cho toàn bộ hệ thống ERP theo nguyên tắc **Zero-Trust Audit Tracking**.

Các nghiệp vụ trọng tâm:
- **Tự động Bắt Biến động Dữ liệu (`GlobalAuditInterceptor`)**: Tự động ghi lại mọi thao tác làm thay đổi dữ liệu (`POST`, `PUT`, `PATCH`, `DELETE`) kèm thông tin người dùng, route, IP, user-agent và snapshot dữ liệu trước/sau.
- **Không Gây Trễ API (Non-blocking Async Batch Buffering)**: Sử dụng hàng đợi đệm trong RAM (In-Memory Queue) tự động gom 50 bản ghi hoặc flush định kỳ mỗi 2 giây vào PostgreSQL, giảm độ trễ ghi log của API xuống **~0ms overhead**.
- **Bảo vệ Dữ liệu Nhạy cảm & Chống Phình to DB (Sanitizer & Payload Capping)**: Đệ quy mask các trường nhạy cảm (`password`, `token`, `secret`, `apiKey`, `cvv`, `pin`, `authorization`) thành `[REDACTED]`, tự động cắt ngắn chuỗi lớn (>5000 ký tự) và tóm tắt mảng lớn (>20 items) để bảo vệ TOAST table.
- **Tự Động Dọn Dẹp Định Kỳ (Retention Scheduler)**: Tự động chạy hàng ngày lúc 02:00 AM để xóa các bản ghi cũ hơn số ngày quy định (`AUDIT_LOG_RETENTION_DAYS`, mặc định 30 ngày) bằng các lô nhỏ không khóa bảng.
- **Cấu hình Bật/Tắt Linh Hoạt (Feature Toggle `ENABLE_AUDIT_LOG`)**: Cho phép bật/tắt toàn bộ việc ghi log, flush DB, interceptor và retention cronjob thông qua biến môi trường `ENABLE_AUDIT_LOG` (mặc định `true`). Khi gán `false`, hệ thống tự động bypass toàn bộ ghi log và trả về danh sách rỗng an toàn mà không gây trễ hoặc lỗi DB.
- **Truy Xuất Dòng Thời Gian Đối Tượng (Entity Timeline Graph)**: Cung cấp API truy vấn lịch sử biến động theo từng chứng từ (`entityType`, `entityId`) phục vụ các Drawer chi tiết trên Frontend.

---

## 2. Database Schema & Quan hệ Dữ liệu

### Bảng `erp_audit_logs` (Nhật ký Kiểm toán Hệ thống)

| Cột | Kiểu dữ liệu | Nullable | Default | Mô tả / Ràng buộc |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Khóa chính (PK) |
| `request_id` | `varchar(128)` | YES | — | Mã định danh request (Correlation ID) |
| `actor_user_id` | `uuid` | YES | — | ID người dùng thực hiện (từ JWT Token) |
| `actor_email` | `varchar(255)` | YES | — | Email người dùng thực hiện |
| `actor_employee_id` | `uuid` | YES | — | ID nhân viên (nếu có) |
| `action_type` | `varchar(100)` | NO | — | Loại hành động (`POST`, `PUT`, `DELETE`, `CONFIRM_PAYMENT`, etc.) |
| `module` | `varchar(100)` | NO | — | Phân hệ phát sinh log (`inventory-items`, `invoices`, `finance`, etc.) |
| `entity_type` | `varchar(100)` | YES | — | Loại thực thể (`payment_voucher`, `core_user`, `goods_receipt`, etc.) |
| `entity_id` | `varchar(255)` | YES | — | ID của thực thể bị thay đổi |
| `route` | `varchar(255)` | YES | — | Đường dẫn API HTTP endpoint |
| `http_method` | `varchar(20)` | YES | — | Phương thức HTTP (`POST`, `PUT`, `PATCH`, `DELETE`) |
| `status` | `varchar(20)` | NO | `'SUCCESS'` | Trạng thái thực thi (`SUCCESS` hoặc `FAIL`) |
| `message` | `text` | YES | — | Thông báo hoặc tóm tắt lý do |
| `ui_screen` | `varchar(255)` | YES | — | Màn hình giao diện phát sinh thao tác |
| `ui_action` | `varchar(255)` | YES | — | Tên hành động trên giao diện người dùng |
| `before_snapshot` | `jsonb` | YES | — | Trạng thái dữ liệu trước khi sửa (đã sanitize) |
| `after_snapshot` | `jsonb` | YES | — | Trạng thái dữ liệu sau khi sửa (đã sanitize) |
| `error_snapshot` | `jsonb` | YES | — | Chi tiết lỗi & stack trace (nếu request thất bại) |
| `ip_address` | `varchar(64)` | YES | — | Địa chỉ IP của client |
| `user_agent` | `text` | YES | — | Thông tin trình duyệt / thiết bị gọi API |
| `created_at` | `timestamp` | NO | `now()` | Thời điểm phát sinh log |

### Chỉ mục Truy vấn (Composite Indexes)
1. `IDX_erp_audit_logs_entity_created`: `(entity_type, entity_id, created_at DESC)` -> Phục vụ tức thì cho `DrawerAuditTimeline`.
2. `IDX_erp_audit_logs_created_at`: `(created_at DESC)` -> Phục vụ sắp xếp nhanh trang nhật ký và điều kiện retention.
3. `IDX_erp_audit_logs_actor_created`: `(actor_user_id, created_at DESC)` -> Phục vụ lọc log theo từng user.
4. `IDX_erp_audit_logs_module_action`: `(module, action_type)` -> Phục vụ lọc theo phân hệ.

---

## 3. Cấu trúc Source Code Backend

```text
src/audit-core/
├── decorators/
│   └── audit-log.decorator.ts          # Decorator @AuditLog() tùy biến metadata hoặc cờ skip
├── dto/
│   └── audit-log-core-query.dto.ts     # DTO phân trang, lọc module, user, date, search
├── entities/
│   └── erp-audit-log.entity.ts         # TypeORM Entity định nghĩa bảng và 4 composite indexes
├── interceptors/
│   └── global-audit.interceptor.ts     # NestJS Global Interceptor tự động bắt request mutation
├── schedulers/
│   ├── audit-retention.scheduler.ts    # Cronjob 02:00 AM dọn dẹp log quá hạn theo batch
│   └── audit-retention.scheduler.spec.ts # Unit tests cho retention scheduler
├── utils/
│   ├── audit-payload.sanitizer.ts      # Tiện ích đệ quy mask key nhạy cảm & cắt tỉa payload
│   └── audit-payload.sanitizer.spec.ts # Unit tests cho payload sanitizer
├── audit-core.controller.ts            # Controller cung cấp GET /audit-core và timeline API
├── audit-core.service.ts               # Core Service chứa Async Buffer, Bulk Insert & Diff Builder
├── audit-core.service.spec.ts          # Unit tests cho Async Buffer & Diff Builder
└── audit-core.module.ts                # NestJS Module đăng ký Controller, Service & Scheduler

src/audit-logs/
├── audit-logs.controller.ts            # Legacy Controller (đã chuyển tiếp sang AuditCoreService)
├── audit-logs.service.ts               # Service tương thích ngược (hoàn toàn dùng AuditCoreService)
└── audit-logs.module.ts                # Module import AuditCoreModule
```

---

## 4. Danh sách API Endpoints & RBAC Contract

Controller Base Route: `/api/v1/audit-core`

| Method | Endpoint | Auth Guard | Query / Params | Mô tả |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/audit-core` | `JwtAuthGuard` | `AuditLogCoreQueryDto` (`module`, `actionType`, `entityType`, `entityId`, `actorUserId`, `status`, `dateFrom`, `dateTo`, `search`, `column_search`, `column_filters`, `page`, `pageSize`) | Danh sách audit logs phân trang, hỗ trợ tìm kiếm nâng cao & lọc cột |
| `GET` | `/api/v1/audit-core/column-options` | `JwtAuthGuard` | `columnKey`, `search`, `page`, `pageSize`, `filters` | Trả về danh sách options phân trang và hỗ trợ cross-column filtering |
| `GET` | `/api/v1/audit-core/timeline/:entityType/:entityId` | `JwtAuthGuard` | Params: `entityType`, `entityId` | Lấy toàn bộ timeline lịch sử biến động của một thực thể theo thứ tự thời gian tăng dần |

---

## 5. Logic Nghiệp vụ Trọng tâm

### 5.1. Cơ chế Async In-Memory Batch Buffering
- Khi gọi `recordAction(input)`:
  1. Payload được làm sạch qua `sanitizeAuditPayload`.
  2. Tạo object log và đẩy vào `buffer: Partial<ErpAuditLog>[]` trong RAM.
  3. Nếu `buffer.length >= 50` -> Kích hoạt flush bất đồng bộ ngay lập tức.
  4. Timer chạy mỗi `2000ms` sẽ flush các log còn lại nếu chưa đủ batch.
  5. Đăng ký hook `onApplicationShutdown()` và `onModuleDestroy()` để đảm bảo toàn bộ log trong RAM được ghi hết xuống DB trước khi tiến trình tắt.

### 5.2. Masking Dữ liệu Nhạy cảm & Giới hạn Kích thước Payload
Hàm `sanitizeAuditPayload` đệ quy kiểm tra và bảo vệ:
- Các trường nhạy cảm: `password`, `token`, `secret`, `accessToken`, `refreshToken`, `apiKey`, `pin`, `cvv`, `authorization`, `credit_card` -> Đổi thành `[REDACTED]`.
- Giới hạn độ dài chuỗi ký tự tối đa `5000` ký tự (tự động cắt bớt và ghi chú `[TRUNCATED X chars]`).
- Giới hạn mảng tối đa `20` phần tử (tự động tóm tắt các phần tử còn lại kèm ghi chú số lượng).

### 5.3. Tự động Dọn Log Quá hạn (Non-locking Batch Delete)
- Cronjob chạy lúc **02:00 AM hàng ngày**:
  ```sql
  DELETE FROM erp_audit_logs
  WHERE id IN (
    SELECT id FROM erp_audit_logs
    WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL
    LIMIT 2000
  );
  ```
- Thực hiện xóa theo từng mẻ `2000` dòng lặp lại cho đến khi hết, tránh tình trạng khóa bảng hoặc làm nghẽn CPU trên PostgreSQL database.

### 5.4. Tính Toán So Sánh Diff Thông Minh (`buildDiff`)
Cung cấp phương thức `buildDiff(beforePayload, afterPayload)` trả về danh sách các trường thay đổi thực tế:
```typescript
const diff = auditCoreService.buildDiff(before, after);
// Output: { status: { before: 'PENDING', after: 'CONFIRMED' } }
```

### 5.5. Cơ Chế Feature Toggle & Graceful Fallback (`ENABLE_AUDIT_LOG`)
- **Biến môi trường**: `ENABLE_AUDIT_LOG=true|false` (mặc định `true` nếu không chỉ định).
- **Hành vi khi `ENABLE_AUDIT_LOG=false`**:
  - `GlobalAuditInterceptor`: Bỏ qua ngay ở đầu hàm `intercept()` mà không xử lý payload.
  - `AuditCoreService.recordAction()`: Bỏ qua ngay lập tức, không đưa bản ghi vào RAM buffer.
  - `AuditCoreService.onModuleInit()`: Không khởi chạy `flushTimer`.
  - `AuditRetentionScheduler.handleRetentionCleanup()`: Bỏ qua chu kỳ dọn dẹp hàng ngày.
  - `findAll()` / `getEntityTimeline()`: Trả về `{ data: [], total: 0 }` hoặc `[]` một cách an toàn mà không bắn query lỗi đến PostgreSQL.

---

## 6. Tích hợp Liên Module & Frontend

- **`payment-vouchers` & `cashflow-vouchers`**: Sử dụng `AuditLogsService` (đã được bọc nối sang `AuditCoreService`) để lưu vết các bước xác nhận thanh toán, cấn trừ và hoàn tiền.
- **`GlobalAuditInterceptor`**: Tự động áp dụng cho tất cả các Controller trong hệ thống, tự động nhận diện module từ URL và lưu snapshot.
- **Frontend (`erp-web`)**:
  - `ErpActivityLogsPage.tsx`: Trang quản trị xem nhật ký toàn hệ thống với bộ lọc nâng cao.
  - `DrawerAuditTimeline.tsx`: Component hiển thị dòng thời gian lịch sử trong các Drawer chi tiết chứng từ.

---

## 7. Quy tắc Kiểm thử & QC Mandate

Khi chỉnh sửa module `audit-core`:
1. **Chạy Unit Tests**:
   ```bash
   bunx jest src/audit-core
   ```
2. **Type Check**:
   ```bash
   bun run type:check
   ```
3. **Database Migration**:
   - Áp dụng migration index: `src/migrations/20260822140000-add-audit-logs-indexes.ts`.

---

## 8. Hiện trạng v2 (nguồn đúng khi mâu thuẫn với mục 2-5)

**Cấu trúc**
```text
src/v2/core/audit-core/            # base-only: types, sanitizer(+spec), buildAuditDiff, AbstractAuditWriterService, manifest
src/v2/modules/audit-logs/
├── entities/audit-log.entity.ts   # @Entity('audit_logs'), cột như erp_audit_logs, 4 index IDX_audit_logs_*
├── dto/ helpers/                  # DTO query/response, mapper, bộ lọc column_filters/column_search/sorts (giữ ngữ nghĩa V1)
├── services/                      # AuditWriterService (buffer 50/2s), AuditLogQueryService (list, column-options, timeline)
├── interceptors/global-audit.interceptor.ts   # APP_INTERCEPTOR (app.module trỏ vào đây)
├── jobs/audit-retention.job.ts    # ScheduledJob 02:00 Asia/Ho_Chi_Minh, lô 2000
├── controllers/audit-log.controller.ts        # @Controller('api/v2/audit-logs')
└── audit-logs-v2.service.ts / audit-logs-v2.module.ts   # facade + module (hậu tố V2 tránh trùng AuditLogsModule của v1)
```

**API v2** (chỉ `JwtAuthGuard`): `GET /api/v2/audit-logs` (`{items, pagination}`), `GET /api/v2/audit-logs/column-options` (`{items, pagination}`), `GET /api/v2/audit-logs/:entityType/:entityId/timeline` (`{items}`, cũ đến mới). Route v1 đúng là `/api/v1/audit-logs-core` (các mục 4 phía trên ghi `audit-core` là sai).

**Migration**: `src/migrations/20261115140000-create-audit-logs-v2.ts` tạo `audit_logs` + backfill `INSERT ... SELECT ... ON CONFLICT (id) DO NOTHING` từ `erp_audit_logs`; `down()` chỉ DROP `audit_logs`. Sau mỗi lần deploy API mới ở môi trường khác, chạy lại câu backfill để bù log phát sinh trong cửa sổ cắt chuyển.

**Rủi ro và lưu ý**
- **JWT-only (giữ hành vi cũ)**: ai đăng nhập cũng xem được toàn bộ nhật ký và timeline (có email, IP, snapshot). Chưa có `@RequirePermissions`. Nếu siết RBAC thì phải đổi cả v1 và v2 và báo web.
- **Retention phụ thuộc `ENABLE_CRON`**: v1 dùng `@Cron` chạy ở mọi môi trường; v2 là `ScheduledJob` nên chỉ chạy khi `ENABLE_CRON=true`. Môi trường không đặt biến này sẽ không xóa log cũ.
- Một request đăng nhập sinh 2 dòng (`LOGIN_*` do auth service + `POST` do interceptor): hành vi từ trước, không phải ghi trùng.
- Caller cũ (`auth`, `users-admin`, `garage-cashflow`...) vẫn gọi `AuditCoreService.recordAction`, nay đi qua writer v2.
- Test: `bunx jest src/v2/core/audit-core src/v2/modules/audit-logs src/audit-core --forceExit`.
