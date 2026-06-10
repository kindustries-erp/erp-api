# ERP CORE Docs Index — API

File này là entrypoint nhanh cho agent/developer khi vào repo `liouni-erp-api` thuộc lane `erp-core`.

## Purpose
- Giúp agent đọc đúng bộ docs cho lane `erp-core`
- Tránh nhầm giữa:
  - **active ERP CORE docs**
  - **legacy ERP/Directus docs kept for history**

## Read this first
1. `../AGENTS.md`
2. `../docs-ai/MASTER_CONTEXT.md`
3. `../docs-ai/runbooks/liouni-erp-ops.md`
4. `../docs-ai/liouni-erp/erp-shared-context.md`
5. `../docs-ai/liouni-erp/artifacts/20260609-erp-core-master-plan-and-status.md`
6. File này: `docs/erp-core-index.md`
7. Task file core liên quan trong `docs/tasks/`

## Canonical lane meaning
- `/opt/repos/liouni-erp-core/liouni-erp-api` = active ERP CORE API source root
- `/opt/repos/liouni-erp` = legacy/Directus lane source root
- Các link sang `/opt/repos/liouni-erp/directus-staging/...` trong task docs có thể là **historical DB references**, không mặc định là bug

## Recommended active ERP CORE docs
Đây là nhóm file nên ưu tiên đọc khi làm lane `erp-core`:

### Bootstrap / architecture
- `docs/tasks/20260607-erp-core-api-neon-bootstrap.md`
- `docs/tasks/20260607-165837-erp-core-neon-business-modules-phase1.md`
- `docs/tasks/20260607-erp-core-postgres-scan-and-plan.md`

### Core delivery / deploy / verify
- `docs/tasks/20260608-101936-fix-wave2-action-endpoint-invalid-uuid.md`
- `docs/tasks/20260608-123500-erp-core-elite-deploy.md`
- `docs/tasks/20260608-145500-create-erp-core-admin-account.md`
- `docs/tasks/20260608-204700-erp-core-wave2-mfg-directus-cleanup.md`
- `docs/tasks/20260608-214100-erp-core-wave2-lot-serial-stock-summary.md`
- `docs/tasks/20260608-233500-purchase-order-core-compatibility-fix.md`
- `docs/tasks/20260608-235600-po-core-strict-and-wave2-flow-verify.md`
- `docs/tasks/20260609-0150-so-rollup-after-gi-post.md`

## Docs classification guide

### A. Active ERP CORE docs
Dấu hiệu thường gặp:
- filename chứa `erp-core`
- nhắc `Neon`, `Postgres`, `10010`, `core lane`
- mô tả purchase / goods receipt / bom / production / sales order / goods issue của lane core

### B. Legacy docs kept for history
Các docs về các mảng sau thường là legacy ERP lane, không phải active core scope mặc định:
- AR workbench
- customer advance
- payment voucher
- cash/bank
- sinvoice / tax portal
- approval-log cũ
- Directus-era module behavior ngoài phạm vi core

### C. Mixed docs
Một số doc có thể chứa cả:
- evidence cũ từ legacy lane
- nhưng vẫn hữu ích cho core migration/review

Với nhóm này, dùng chúng như **reference/history**, không coi là contract chính nếu mâu thuẫn với canonical docs trong `docs-ai/`.

## Decision rule if docs conflict
Thứ tự ưu tiên nguồn sự thật:
1. `docs-ai/liouni-erp/artifacts/20260609-erp-core-master-plan-and-status.md`
2. `docs-ai/liouni-erp/erp-shared-context.md`
3. runtime/API source hiện tại
4. task doc repo-local mới nhất thuộc lane `erp-core`
5. legacy task docs chỉ để tham chiếu

## Practical instruction for agents
Nếu user nói chung chung như “tiếp tục lane ERP CORE”, mặc định:
1. đọc canonical artifact trong `docs-ai`
2. đọc file task core gần nhất liên quan module đang sửa
3. inspect runtime/source hiện tại
4. làm theo DB -> API -> UI -> QC
