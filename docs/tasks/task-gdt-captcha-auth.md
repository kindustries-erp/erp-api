# Task: Enhance GDT Portal Login Mechanism with Captcha

## Status
- Completed

## Scope
- erp-api: Add `gdt_portal_username`, `gdt_portal_password` to `company_profile`
- erp-api: Add migration `1786200000000-AddGdtPortalAuthToCompanyProfile.ts`
- erp-api: Add `getCaptcha()` and `loginWithCaptcha()` to `InvoicePortalService`
- erp-api: Expose `GET /portal/captcha` and `POST /portal/login` in `ErpInvoicesCoreController`
- erp-api: Unit tests in `invoice-portal.service.spec.ts`

## Checklist
- [x] DB: Update `CompanyProfile` entity and create migration
- [x] API: Implement Captcha and Login in `InvoicePortalService`
- [x] API: Add endpoints and DTOs to controller
- [x] API: Add tests for captcha & login (12 passed)
- [x] Verification: `bun run build`, `bun run type:check`, `bun test`
