# Journal Entries API Contract

Base path: `/api/v1/journal-entries`
Auth: `Bearer <Directus access token>` (hoặc impersonation token, backend dùng effective Directus token).

## Data model

### JournalEntry
- `id`: uuid
- `voucher_no`: string
- `date`: `YYYY-MM-DD`
- `period_id`: uuid | object | null
- `description`: string | null
- `status`: `draft` | `posted` | `reversed`
- `reference_type`: string | null
- `reference_id`: string | null
- `total_debit`: number
- `total_credit`: number
- `created_by`: uuid | null
- `created_at`: datetime
- `updated_at`: datetime

### JournalEntryLine
- `id`: uuid
- `account_id`: uuid hoặc object `{ id, account_code, account_name }`
- `debit`: number
- `credit`: number
- `description`: string | null
- `sort`: number | null

## Endpoints

### GET `/journal-entries`
Query:
- `page`: number, default 1
- `pageSize`: number, default 20
- `sort`: string, default `-date`
- `search`: string
- `status`: `draft` | `posted` | `reversed`
- `period_id`: uuid
- `account_id`: uuid (filter qua `journal_entry_lines`)
- `date_from`: `YYYY-MM-DD`
- `date_to`: `YYYY-MM-DD`

Response:
```json
{
  "items": ["JournalEntry"],
  "total": 0,
  "page": 1,
  "pageSize": 20,
  "totalPages": 0
}
```

### GET `/journal-entries/:id`
Response:
```json
{
  "message": "Lấy thông tin bút toán thành công",
  "data": {
    "...JournalEntry": "...",
    "lines": ["JournalEntryLine"]
  }
}
```

### POST `/journal-entries`
Request:
```json
{
  "voucher_no": "optional",
  "date": "2026-05-10",
  "period_id": "optional-accounting-period-uuid",
  "description": "Diễn giải",
  "reference_type": "manual",
  "reference_id": "optional-source-id",
  "lines": [
    { "account_id": "uuid", "debit": 1000, "credit": 0, "description": "Nợ", "sort": 0 },
    { "account_id": "uuid", "debit": 0, "credit": 1000, "description": "Có", "sort": 1 }
  ]
}
```
Rules:
- Tối thiểu 2 dòng.
- `sum(debit) == sum(credit)`; nếu không cân trả 400.
- Tạo ở trạng thái `draft`.
- Nếu thiếu `period_id`, backend thử tìm kỳ `open` khớp ngày.

### POST `/journal-entries/:id/post`
Rules:
- Chỉ cho `draft -> posted`.
- Trạng thái khác trả 400.

### POST `/journal-entries/:id/reverse`
Request:
```json
{ "reason": "Lý do đảo", "reverse_date": "2026-05-10" }
```
Rules:
- Chỉ cho entry `posted`.
- Tạo bút toán đảo `REV-<voucher_no>` ở trạng thái `posted`.
- Đổi entry gốc sang `reversed`.

## Lookup endpoints for UI

### GET `/journal-entries/lookup/accounts?search=`
Returns up to 200 chart accounts:
```json
{ "items": [{ "id": "uuid", "account_code": "111", "account_name": "Tiền mặt", "account_type": "asset" }] }
```

### GET `/journal-entries/lookup/periods`
Returns latest accounting periods:
```json
{ "items": [{ "id": "uuid", "name": "2026-05", "status": "open", "start_date": "2026-05-01", "end_date": "2026-05-31" }] }
```
