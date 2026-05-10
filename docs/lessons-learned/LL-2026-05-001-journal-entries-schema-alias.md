# Lessons Learned — Journal Entries API Schema Alias Mismatch

- ID: LL-2026-05-001
- Date: 2026-05-10
- Task Link: docs/tasks/task-01-journal-entry-api.md
- Owner: Hermes

## Context

Gate 2 triển khai API Journal Entry dựa trên Directus staging schema mới tạo ở DB gate.

## Issue / Symptom

Smoke test `GET /journal-entries/lookup/accounts` trả 403 vì API query field `code`/`name` trên `chart_of_accounts`.
Smoke test `GET /journal-entries/:id` trả 403 vì API query alias O2M `lines` trên `journal_entries`.

## Root Cause

Schema thực tế của `chart_of_accounts` dùng `account_code` và `account_name`, không dùng `code`/`name`.
DB gate tạo relation M2O từ `journal_entry_lines.journal_entry_id` về `journal_entries.id` nhưng chưa tạo alias field O2M `lines` trên `journal_entries`, nên Directus REST không thể expand `lines.*` từ header.

## Fix Applied

- Đổi lookup/detail account fields sang `account_code` và `account_name`.
- Đổi `findOne` sang fetch header trước, sau đó fetch `journal_entry_lines` bằng filter `journal_entry_id = id`.
- Đổi filter `account_id` trong list sang query `journal_entry_lines` trước rồi filter journal entry header theo danh sách id.

## Preventive Action

Trước khi code Directus join/expand, luôn kiểm tra `/fields/<collection>` của cả collection cha và con. Không assume alias O2M tồn tại chỉ vì M2O relation đã được tạo.

## Reusable Snippet / Pattern (optional)

Nếu collection cha không có O2M alias:
1. Query collection con với filter FK.
2. Lấy unique parent ids.
3. Query collection cha với `{ id: { _in: parentIds } }`.
