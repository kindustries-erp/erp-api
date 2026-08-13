---
name: erp-gate-0-precheck
description: Gate 0 DB precheck cho ERP: xác minh schema, field, constraint và relation trực tiếp từ Postgres runtime thật qua DATABASE_URL trước khi code API hoặc UI.
---

# Kỹ năng Gate 0 DB Precheck (ERP)

## Mục đích

Ngăn chặn việc đoán mò cấu trúc database. Mọi thay đổi liên quan DTO, service, controller, query, form, filter, hoặc business flow đều phải kiểm tra DB thật trước.

## Cách thực hiện

Khi bắt đầu task liên quan đến API hoặc UI có đọc/ghi dữ liệu, bạn BẮT BUỘC phải thực hiện Gate 0 theo thứ tự sau:

1. Xác định `DATABASE_URL` đang dùng cho lane hiện tại từ `.env`, stack env, hoặc runtime config phù hợp.
2. Dùng terminal để query trực tiếp Postgres bằng chính `DATABASE_URL` đó.
3. Xác minh đầy đủ:
   - bảng trong scope
   - tên cột thật
   - kiểu dữ liệu
   - giá trị default / nullable
   - primary key / foreign key / unique / check / index quan trọng
4. Ghi lại evidence DB trước khi sửa DTO, service, query, API contract, hoặc UI contract.

## Ví dụ lệnh

Kiểm tra cấu trúc bảng:

```bash
psql "$DATABASE_URL" -c "\d users"
```

Kiểm tra cột của một bảng:

```bash
psql "$DATABASE_URL" -c "
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;
"
```

Kiểm tra ràng buộc:

```bash
psql "$DATABASE_URL" -c "
SELECT conname, contype, pg_get_constraintdef(c.oid)
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE t.relname = 'users'
ORDER BY conname;
"
```

## Bắt buộc ghi nhận

- bảng nào được đọc/ghi
- field nào required / optional / computed
- relation nào ảnh hưởng business flow
- constraint nào có thể làm request fail hoặc làm sai side effect
- kết luận Gate 0: `DB_READY` hoặc `DB_GAP_FOUND`

## Cấm

- Cấm viết code API/UI trước khi query DB thật.
- Cấm suy ra field hoặc enum chỉ từ memory, code cũ, type cũ, hoặc mock data.
- Cấm kết luận contract dữ liệu khi chưa có evidence từ Postgres runtime.
- Nếu Gate 0 ra `DB_GAP_FOUND`, phải xử lý gap trước rồi mới sang API/UI.
