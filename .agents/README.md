# Liouni ERP API Agent Pack

Đây là source of truth cho mọi agent làm việc trong repo này.

## Read order
1. `context/current-truth.md`
2. `context/working-contract.md`
3. `tasks/current-lane.md`
4. `skills/liouni-erp-api-current-truth/SKILL.md`
5. `rules/liouni-erp-api.md`

## Purpose
- gom current-truth, working contract, task-lane entrypoint, skill/rule vào một chỗ
- tránh agent phải tự suy luận từ nhiều docs lịch sử trong `docs/`
- tách rõ `agent bootstrap` khỏi `implementation docs`

## Boundary
- `.agents/` = agent-facing source of truth
- `docs/` = implementation docs, task history, lessons learned, domain references

## Historical handling rule
Nếu một file trong `docs/` nhắc Directus, Gitea, old dev domains, hoặc branch `erp-core`, phải mặc định xem là historical/reference trước khi dùng cho implementation mới.
