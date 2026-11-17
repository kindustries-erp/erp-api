---
name: employees-core
description: Module tri thức Nhân viên V2 trong erp-api gồm lõi src/v2/core/employees-core và module src/v2/modules/employees-management (route /api/v2/employees, bảng employees_management). Chứa schema, contract API, quy tắc xóa/CCCD/ngày, liên kết tài khoản với users-management và quan hệ với V1 erp_employees đã đóng băng.
---

# Module Tri Thức: Employees V2 - Backend (`erp-api`)

## 1. Phạm vi

- Lõi: `src/v2/core/employees-core` (entity, DTO, mapper, query/command service, facade). Module HTTP: `src/v2/modules/employees-management` (controller + facade), route `api/v2/employees`.
- Bảng `employees_management` (migration `20261115130000-create-employees-management`). Bảng bắt đầu rỗng, không backfill từ `erp_employees`.
- V1 (`src/employees-core`, `/api/v1/employees`, bảng `erp_employees`) vẫn chạy nhưng bị đóng băng, không đồng bộ sang bảng mới. Không xóa V1 khi chưa có lệnh.
- Quyền: `ErpResource.EMPLOYEES` với READ/CREATE/UPDATE/DELETE (guard không coi `manage` là tập cha).

## 2. Schema `employees_management`

Kế thừa `CoreSoftDeletableEntity`: `id`, `extra_data` (jsonb, CHECK object), `created_at`/`updated_at` timestamptz, `is_deleted`. Cột riêng: `employee_code`, `full_name`, `email`, `phone`, `status` (ACTIVE/INACTIVE), `user_id`, `address`, `notes`, `birth_date`/`start_date`/`leave_date` (timestamptz), `job_title`, `department` (text tự do), `branch_id` (FK `erp_branches`), `national_id` (varchar 20).
Unique một phần `WHERE is_deleted = false`: `employee_code`, `user_id`, `national_id` (khi khác null). Mã đã xóa mềm dùng lại được.

## 3. Contract API

`GET /` (`{ items, pagination, summaries }`), `GET /column-options`, `GET /next-code` (NV-001...), `GET /:id` (`{ message, data }`), `GET /:id/national-id` (quyền UPDATE), `POST /`, `PATCH /:id`, `POST /:id/status`, `DELETE /:id` (xóa mềm).

- Response có `branch {id,code,name}`, `linkedUser {id,email}` và `nationalIdMasked`; không bao giờ trả CCCD đầy đủ ở list/detail. CCCD không nằm trong whitelist lọc/tìm kiếm.
- `userId` không ghi qua API này: liên kết do users-management quản lý. Xóa bị chặn 409 khi còn `userId`.
- Trùng mã/CCCD trả 409; chi nhánh không tồn tại trả 400. `PATCH`: `null` xóa giá trị cột nullable, trường bắt buộc (`fullName`, `employeeCode`, `status`) bỏ qua `null`.
- Chuyển sang INACTIVE tự điền `leaveDate` = hiện tại nếu trống; chuyển lại ACTIVE xóa `leaveDate`. `leaveDate >= startDate`, `birthDate` không ở tương lai.

## 4. Liên kết với users-management

`users_management.employee_id` trỏ FK sang `employees_management(id)` `ON DELETE SET NULL`. Migration đã sao lưu liên kết cũ vào `employees_management_legacy_user_links` rồi đặt NULL (liên kết lại thủ công). `UsersEmployeeLinkService` (khóa `pessimistic_write`) từ chối nhân viên đã xóa (404) và nhân viên INACTIVE khi liên kết mới (400). `ApprovalActorService` và `auth.mapper` dùng entity mới.

## 5. Kiểm thử

`bunx jest src/v2/core/employees-core src/v2/modules/employees-management src/v2/modules/users-management src/v2/modules/auth-sessions src/v2/core/approval-core --forceExit`; migration spec `src/migrations/20261115130000-create-employees-management.spec.ts`.
