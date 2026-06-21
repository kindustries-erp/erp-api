# Task: Goods issue draft create and MO warehouse lock hotfix

> **Created:** 2026-06-20
> **Lane:** erp-master
> **Repo:** `liouni-erp-api`
> **Status:** IN_PROGRESS

## Scope
- Fix goods-issue create/update hot path so production warehouse export draft/new save does not fail on valid UI payload shape.
- Enforce manufacturing lock: do not allow finished-goods receipt/post while required production material issue is incomplete.
- Enforce warehouse document lock: do not allow editing goods-issue draft when it is attached to a production order.

## DB gate
- No schema change unless current entities prove a hard gap.
- Reuse existing production-order, goods-issue, goods-receipt, and document-dependency contracts first.

## API target
- Audit DTO validation and auto-number/default behavior for goods issue create/update.
- Add service-level production guard before posting goods receipt for MO-linked receipts.
- Add service-level lock on goods-issue draft update when linked to production order.

## Evidence target
- Production GI draft/new save accepts blank number path via API contract used by Web.
- MO-linked finished-goods receipt cannot post before required material issue is complete.
- MO-linked goods issue cannot be edited after attachment rule is enforced.

## Verification
- Pending
