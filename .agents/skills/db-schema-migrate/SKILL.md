---
name: db-schema-migrate
description: Skill alias cho các tác vụ schema migration (generate/sync-schema) trong erp-api, dùng chung runner chuẩn và guard Neon pooler.
---

# Hướng dẫn DB Schema Migrate (erp-api)

Skill này dùng cho các yêu cầu:

- tạo migration từ thay đổi entity
- đồng bộ schema theo entity mà không chép dữ liệu

## Quy tắc bắt buộc

- Không gọi TypeORM CLI trực tiếp.
- Luôn chạy qua runner chuẩn:

```bash
bash .agents/skills/db-migrate/scripts/typeorm-runner.sh generate <TARGET_ENV_FILE> <MIGRATION_NAME>
bash .agents/skills/db-migrate/scripts/typeorm-runner.sh sync-schema <TARGET_ENV_FILE>
```

- Runner tự xử lý Neon pooler URL (`-pooler`) để giảm rủi ro lỗi migration/DDL.

## Ví dụ

```bash
bash .agents/skills/db-migrate/scripts/typeorm-runner.sh generate .env.local AddPartnerStatus
bash .agents/skills/db-migrate/scripts/typeorm-runner.sh sync-schema .env.local
```

## Hậu kiểm

- Đọc output để xác nhận migration/sync thành công.
- Báo lại rõ env file đã dùng và file migration được tạo.
