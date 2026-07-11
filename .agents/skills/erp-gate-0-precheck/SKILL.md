---
name: erp-gate-0-precheck
description: Skill tự động thực hiện DB precheck bằng cách query vào local PostgreSQL container để lấy thông tin collection, field, constraints trước khi code API.
---

# Kỹ năng Gate 0 DB Precheck (ERP)

## Mục đích
Ngăn chặn tình trạng Backend hoặc Frontend Agent "đoán mò" cấu trúc database (tên trường, kiểu dữ liệu, các quan hệ) thay vì kiểm tra thực tế.

## Cách thực hiện
Khi bạn bắt đầu task liên quan đến API DTOs, Controllers hoặc viết tính năng mới cần lấy dữ liệu từ DB, bạn BẮT BUỘC phải thực hiện Precheck này.

1. Hãy sử dụng công cụ `run_command` để query trực tiếp vào Database thông qua Docker. Tuỳ vào môi trường local (vd `liouni-erp-db` container):
   
   Ví dụ lệnh kiểm tra cấu trúc bảng `users`:
   ```bash
   docker exec liouni-erp-db psql -U postgres -d erp_db -c "\d users"
   ```
   *(Chú ý thay đổi tên container, user, dbname cho khớp với môi trường local thực tế, thường có thể tìm thấy trong .env hoặc docker-compose.yml)*

2. Lấy được danh sách các cột, kiểu dữ liệu (varchar, uuid, timestamp), và các khóa ngoại (foreign keys).
3. Sau khi có kết quả, lưu thông tin này vào context hoặc comment trong file DTO/Model bạn sắp tạo để làm bằng chứng (evidence) cho Gate 0.

## Cấm:
- Cấm tuyệt đối query vào `directus-staging-db` trừ khi task file ghi rõ là `[LEGACY-SCOPE]`.
- Cấm viết code API DTO/Interface trước khi query DB.
