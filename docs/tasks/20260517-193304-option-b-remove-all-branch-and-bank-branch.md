# Task — Remove all branch and bank_branch references (Option B)

## Request Input (bạn chỉ cần điền phần này)
- Type: FIX
- Mục tiêu: Xóa sạch mọi reference liên quan tới `branch` và `bank_branch` khỏi DB, API, FE theo Option B.
- Bối cảnh/ngữ cảnh: Sau khi đã revert các fix pagination/sort cũ cho branch, user chọn tiếp tục Option B: xóa cả `bank_branch`, không chỉ `branch` business entity.

## Goal
Loại bỏ hoàn toàn mọi reference `branch`, `branches`, `branch_id`, `bank_branch`, route/tab/i18n tương ứng khỏi Directus staging, ERP API, và ERP Web; sau đó build, deploy, và verify runtime.

## Scope
- In-scope:
  - Drop các cột `bank_branch` còn lại trong Directus/Postgres.
  - Xóa metadata Directus liên quan `bank_branch`.
  - Xóa source `src/branches/*` và các DTO/API/route/i18n/UI còn sót liên quan `branch`/`bank_branch`.
  - Rebuild + redeploy ERP API và ERP Web.
- Out-of-scope:
  - Không reset repo.
  - Không đụng dữ liệu/runtime ngoài scope branch cleanup.
  - Không sửa các dirty changes unrelated đã tồn tại ở FE repo.

## Relevant Files
- `src/branches/*` - module branch backend bị loại bỏ hoàn toàn.
- `src/business-partner-bank-accounts/dto/create-business-partner-bank-accounts.dto.ts` - xóa `bank_branch`.
- `src/company-bank-accounts/dto/create-company-bank-account.dto.ts` - xóa `bank_branch`.
- `src/company-bank-accounts/dto/update-company-bank-account.dto.ts` - xóa `bank_branch`.
- `../liouni-erp-web/src/App.tsx` - bỏ route/page key `thietlap-branch`.
- `../liouni-erp-web/src/core/components/layout/Sidebar.tsx` - bỏ nav branch.
- `../liouni-erp-web/src/core/config/appStore.ts` - bỏ metadata `catalogBranches` / breadcrumb branch.
- `../liouni-erp-web/src/core/locale/{vi,en}.ts` - bỏ copy/i18n branch liên quan.
- `../liouni-erp-web/src/modules/partners/**` - xóa `bank_branch` khỏi types/api/components/forms.
- `../liouni-erp-web/src/shared/{types,index.ts,utils/pageUrl.ts}` - bỏ page key/url slug branch.

## Gate 0 — DB Precheck (bắt buộc)
- Collections/fields liên quan:
  - `public.branches` (đã bị xóa trước đó)
  - `public.business_partner_bank_accounts.bank_branch`
  - `public.company_bank_accounts.bank_branch`
  - `directus_fields` metadata tương ứng
- Data nền cần có:
  - Backup Directus staging trước khi mutate DB.
- Constraint/index/default cần có:
  - Không còn constraint/index phụ thuộc `bank_branch` ở 2 bảng trên.
- Kết quả: `DB_READY`
- Nếu `DB_GAP_FOUND`: link DB task (directus-staging): N/A

## Coordination Impact
- [x] Directus staging schema affected
- [x] ERP Web contract affected
- [ ] No cross-system impact

## Checklist (cập nhật realtime)
- [x] 1.0 Gate 0 DB Precheck done
- [x] 2.0 Backend workflow/API gate done
- [x] 3.0 UI handoff gate done
- [x] 4.0 Validate
  - [x] 4.1 `npm run build`
  - [x] 4.2 Smoke test affected endpoints
- [x] 5.0 Close
  - [x] 5.1 Lessons learned entry (if issue)
  - [x] 5.2 Commit + push code (web/api)
  - [x] 5.3 Summary with evidence

## Validation Evidence
- DB precheck result:
  - Backup: `/opt/backups/directus-staging/20260517191905/directus-staging-before-option-b-branch-purge.sql`
  - Precheck trước mutate cho thấy còn:
    - `business_partner_bank_accounts|bank_branch`
    - `company_bank_accounts|bank_branch`
  - SQL apply:
    - `ALTER TABLE ... DROP COLUMN IF EXISTS bank_branch CASCADE` trên 2 bảng.
    - `DELETE FROM directus_fields ... bank_branch` => `DELETE 2`
  - Verify sau mutate:
    - query `information_schema.columns where column_name ilike '%branch%'` => rỗng
    - query `directus_fields where field ilike '%branch%' or collection ilike '%branch%'` => rỗng
  - Restart Directus staging OK.
- Build:
  - API: `npm run build` PASS trong repo `/opt/repos/liouni-erp/liouni-erp-api`
  - Web: `npm run build` PASS trong repo `/opt/repos/liouni-erp/liouni-erp-web`
- Smoke:
  - `curl -I https://dev.erp.liouni.com/` => HTTP 200
  - `curl -I https://dev.api.erp.liouni.com/api/v1` => HTTP 200
  - `curl https://dev.api.erp.liouni.com/api/v1` => `Hello World!`
  - Bundle grep trong container web:
    - không còn `thiet-lap-chi-nhanh|bank_branch|catalogBranches|thietlap-branch`

## Lessons Learned
- Link: `No issue`
- Ghi chú: Với cleanup destructuve kiểu này, cần tách rõ preflight backup DB, grep source theo marker cụ thể, rồi build từng repo riêng trước khi deploy. Không dùng broad reset vì repo FE có dirty changes unrelated.

## Commit/Push Status
- API repo:
  - `4c31e58 chore: remove remaining branch/bank_branch references for option B`
- Web repo (if affected):
  - `9f90dc9 chore(web): remove remaining branch and bank_branch references (option B)`
- DB/directus staging: apply+verify+document (no code push required)
