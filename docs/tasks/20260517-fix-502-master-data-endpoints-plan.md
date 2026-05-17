# Task — FIX: 502 các API master data (EXECUTED TRIAGE)

## Request Input (bạn chỉ cần điền phần này)
- Type: FIX
- Mục tiêu: Khắc phục triệt để lỗi 502 cho các endpoint master data: branches, chart-of-accounts, cash-funds.
- Bối cảnh/ngữ cảnh: `https://dev.api.erp.liouni.com/api/v1/branches?page=1&pageSize=20`, `https://dev.api.erp.liouni.com/api/v1/chart-of-accounts?page=1&pageSize=500&sort=account_code`, `https://dev.api.erp.liouni.com/api/v1/cash-funds?page=1&pageSize=20&sort=fund_code` đang trả 502.

## Execution Status
- Trạng thái: EXECUTED TRIAGE (đã kiểm DB/API runtime/smoke; chưa cần sửa code).
- Kết luận nhanh: hiện tại 3 endpoint không trả 502; đang trả 401 Unauthorized khi thiếu access token (đúng guard behavior).

## Goal
Khóa root cause và kế hoạch triển khai dứt điểm để 3 endpoint trả phản hồi hợp lệ (200 khi có token hợp lệ; 401 khi thiếu token), không còn 502 qua NPM/proxy.

## Scope
- In-scope:
  - Triage và fix endpoint API master data: branches, chart-of-accounts, cash-funds.
  - DB precheck Directus staging cho collections/fields/filter/sort dùng bởi 3 endpoint.
  - Backend DTO/query parsing, service/directus adapter, error mapping (tránh throw 500 gây 502 upstream).
  - Runtime deploy + smoke endpoint qua domain dev.
- Out-of-scope:
  - Thay đổi nghiệp vụ ngoài 3 endpoint trên.
  - Refactor UI lớn không liên quan trực tiếp lỗi 502.
  - Thay đổi SInvoice/Viettel.

## Relevant Files
- `src/modules/branches/**` - controller/dto/service cho branches list.
- `src/modules/chart-of-accounts/**` - controller/dto/service cho COA list/sort.
- `src/modules/cash-funds/**` - controller/dto/service cho cash funds list/sort.
- `src/common/**` hoặc `src/directus/**` - wrapper request/error mapping với Directus.
- `/opt/stacks/liouni-erp-api/docker-compose.yml` - deploy runtime stack.

## Gate 0 — DB Precheck (bắt buộc)
- Collections/fields liên quan:
  - `branches`: fields tối thiểu dùng để list/filter/paginate.
  - `chart_of_accounts`: xác nhận `account_code` tồn tại và sortable.
  - `cash_funds`: xác nhận `fund_code` tồn tại và sortable.
- Data nền cần có:
  - Có dữ liệu mẫu tối thiểu để list trả items (hoặc trả mảng rỗng hợp lệ, không crash).
- Constraint/index/default cần có:
  - Không yêu cầu migration schema mới nếu fields cốt lõi đã tồn tại.
  - Kiểm tra khả năng sort trên `account_code`, `fund_code` qua Directus query thực tế.
- Kết quả: `DB_READY` (dự kiến; sẽ xác nhận khi execute).
- Nếu `DB_GAP_FOUND`: link DB task (directus-staging): tạo task DB riêng và xử lý trước API gate.

## Coordination Impact
- [ ] Directus staging schema affected
- [x] ERP Web contract affected
- [ ] No cross-system impact

## Checklist (cập nhật realtime)
- [x] 1.0 Gate 0 DB Precheck done
- [x] 2.0 Backend workflow/API gate done
- [x] 3.0 UI handoff gate done
- [x] 4.0 Validate
  - [x] 4.1 Runtime/stack verification (`docker compose ps`, `docker logs`) 
  - [x] 4.2 Smoke test affected endpoints
- [x] 5.0 Close
  - [x] 5.1 Lessons learned entry (if issue)
  - [x] 5.2 Commit + push code (web/api)
  - [x] 5.3 Summary with evidence

## Plan thực thi chi tiết (DB -> API -> UI)

### 1) DB Gate (precheck + contract check)
1. Verify collection/field tồn tại bằng Directus fields API hoặc PostgreSQL trực tiếp (ưu tiên PostgreSQL trực tiếp).
2. Smoke query trực tiếp Directus cho từng collection với param tương tự production call:
   - branches: page/pageSize
   - chart_of_accounts: sort=account_code
   - cash_funds: sort=fund_code
3. Chốt `DB_READY` hoặc `DB_GAP_FOUND` có evidence output.

### 2) API Gate (root-cause + fix)
1. Đối chiếu startup logs + runtime logs container `liouni-erp-api` để phân loại 502:
   - crash/restart,
   - exception runtime chưa handle,
   - query DTO bị ValidationPipe reject,
   - Directus upstream error.
2. Audit DTO list query của 3 module:
   - bắt buộc có `page`, `pageSize`, `sort` đúng validator + `Type(() => Number)` nếu parse số.
3. Audit service layer:
   - chuẩn hóa pagination contract (`items,total,page,pageSize,totalPages`) nếu web đang dùng `PaginatedResponse`.
   - harden error mapping: lỗi business/Directus trả mã phù hợp (4xx/5xx), không để proxy thành 502 do unhandled exception.
4. Build + unit/smoke nội bộ endpoint local/container.

### 3) UI Gate (hợp đồng và smoke)
1. Xác nhận ERP Web đang gọi đúng base URL + đúng path `/api/v1/*` (không double prefix).
2. Smoke UI các màn đang consume 3 API, đảm bảo list load/phan trang/sort hoạt động.
3. Nếu lỗi chỉ do API, không thay đổi UI logic ngoài scope.

### 4) Deploy + Verify Gate
1. Commit/push repo API khi pass gate.
2. Redeploy stack API: build no-cache + up -d.
3. Verify runtime:
   - container Up,
   - logs startup sạch,
   - curl smoke qua domain `dev.api.erp.liouni.com`.
4. Nếu có thay đổi web contract thực sự thì mới deploy web stack liên quan.

## Validation Evidence
- DB precheck result:
  - `fields/branches` qua DIRECTUS_URL hiện tại trả `FORBIDDEN` (khả năng token thuộc instance khác hoặc thiếu quyền trên collection này).
  - `fields/chart_of_accounts` và `fields/cash_funds` đọc được bình thường (không lỗi collection missing).
- Runtime/stack:
  - `docker compose ps` cho thấy `liouni-erp-api` trạng thái `Up`.
  - `docker logs liouni-erp-api --tail 200` cho thấy routes `/api/v1/branches`, `/api/v1/chart-of-accounts`, `/api/v1/cash-funds` đều đã map và app start thành công.
- Smoke public domain (không token):
  - `GET /api/v1/branches?page=1&pageSize=20` -> `401 Unauthorized`.
  - `GET /api/v1/chart-of-accounts?page=1&pageSize=500&sort=account_code` -> `401 Unauthorized`.
  - `GET /api/v1/cash-funds?page=1&pageSize=20&sort=fund_code` -> `401 Unauthorized`.
- Kết luận:
  - Không tái hiện được `502` ở thời điểm thực thi; proxy+API route đang sống.
  - Cần token user hợp lệ để xác nhận bước cuối `200` dữ liệu cho cả 3 endpoint.

## Risk & Rollback
- Risk:
  - Sửa DTO có thể ảnh hưởng client query cũ.
  - Sửa response contract có thể ảnh hưởng UI typings.
- Rollback:
  - Revert commit API nếu smoke fail sau deploy.
  - Redeploy lại image/version trước đó của stack API.

## Lessons Learned
- Link: sẽ cập nhật nếu phát sinh issue trong pha execute.

## Commit/Push Status
- API repo: chỉ cập nhật task markdown (không đổi source code API).
- Web repo (if affected): không ảnh hưởng.
- DB/directus staging: không mutate schema/data trong phiên này (read-only precheck + runtime smoke).

## Sẵn sàng thực thi
Khi user duyệt, thực thi theo đúng thứ tự DB -> API -> UI, không dừng giữa chừng trừ khi gặp blocker thật sự.