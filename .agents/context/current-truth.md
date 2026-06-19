# Current Truth

- Main ERP lane hiện tại: **GitHub + branch `erp-master`**
- Repo này là API repo của lane active.
- Local path có thể vẫn nằm dưới thư mục lịch sử `liouni-erp-core`, nhưng đó không phải tên branch active.
- Directus-related ERP material = **legacy/reference only** trừ khi task explicit nói legacy maintenance / historical audit.
- Gitea = historical only cho main ERP lane hiện tại.
- Old dev domains không phải current-truth endpoints mặc định.
- Removed stack wrappers `liouni-erp-core-*` không được assume còn tồn tại.

## Repo role
- backend contract
- auth
- DTOs
- persistence
- business rules
- build/test/smoke evidence cho API lane
