---
name: db-migrate
description: Skill hỗ trợ Agent phân loại ý định (generate schema, run migrate, clone/sync data) và gọi runner TypeORM chuẩn cho dự án erp-api, có guard cho Neon pooler URL và backup trước khi apply schema.
---

# Hướng dẫn DB Migrate (erp-api)

Dự án `erp-api` sử dụng TypeORM (`src/db/data-source.cli.ts`) và lưu file migration tại `src/migrations/`.
Bất cứ khi nào User yêu cầu làm việc với Database liên quan đến migration hay copy/sync dữ liệu, bạn **PHẢI** tuân theo các quy tắc nghiêm ngặt dưới đây.

## 0. Quy tắc Database Connection & Neon URL (bắt buộc)

- **Ưu tiên DATABASE_URL:** Runner đọc `DATABASE_URL` từ file `.env` chỉ định.
- **Fallback DB_HOST / DB_PORT:** Nếu file `.env` không có `DATABASE_URL` (hoặc bị comment) nhưng có cấu hình `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_DATABASE`, `DB_SSL`, runner sẽ tự động ghép chuỗi kết nối chuẩn `postgresql://USER:PASS@HOST:PORT/DB?sslmode=...`.
- **Neon Pooler Guard:** Nếu URL kết nối đến Neon host chứa `-pooler` thì runner tự động chuẩn hóa:
  - `ep-xxx-pooler...` -> `ep-xxx...`
  - bỏ `channel_binding=require` khỏi query string nếu có
- **Lý do:** Tránh lỗi ngắt kết nối/transaction khi chạy DDL qua pooler và hỗ trợ linh hoạt cả môi trường Neon cloud lẫn PostgreSQL nội bộ / local (`DB_HOST`).


## 1. Xác định Intent (3 Mode Hoạt Động)

Dựa vào câu lệnh của User, hãy tự suy luận xem họ đang cần ở Mode nào:

- **Mode 1 (generate): `db-schema-migrate`**
  - **Dấu hiệu:** "Tạo file migration cho bảng X", "generate schema", "diff db", "sửa Entity xong rồi"...
  - **Mục đích:** So sánh code Typescript (Entities) với Database đích để sinh ra file `.ts` chứa SQL. Database chưa thay đổi.

- **Mode 2 (run): `db-migrate`**
  - **Dấu hiệu:** "Chạy migration", "apply file migration vào DB", "update cấu trúc bảng"...
  - **Mục đích:** Chạy các file `.ts` đang có vào trong Database. Bước này sẽ làm Database thay đổi. Kịch bản chạy sẽ tự động backup DB trước khi apply.

- **Mode 3 (sync-schema): `db-sync-schema`**
  - **Dấu hiệu:** "Migrate db schema từ code sang local", "Update schema local giống prod (khi code đã giống prod)", "Đồng bộ schema giữ nguyên data"...
  - **Mục đích:** Dùng `TypeORM schema:sync` để tự động đối chiếu Code (Entities) hiện tại và sinh ra lệnh `ALTER TABLE` chạy vào Target DB. An toàn và không gây mất data cũ.

- **Mode 4 (sync): `db-clone` / `db-sync`**
  - **Dấu hiệu:** "Đồng bộ DB từ X sang Y", "Copy toàn bộ DB prod về local", "Đồng bộ cả data"...
  - **Mục đích:** Dùng `pg_dump` và `pg_restore` để copy nguyên bản cấu trúc + DATA (rất nặng và ghi đè toàn bộ data) giữa 2 DB.

---

## 2. Quy Tắc Bắt Buộc

1. **Luôn Xác Nhận Môi Trường (Env Files):**
   - Không bao giờ được chạy ngầm. Phải hỏi hoặc xác định rõ file `.env.*` làm SOURCE và TARGET (ví dụ: `.env.klotus-production`, `.env.staging`, `.env.local`).
2. **Không tự gọi TypeORM trực tiếp:**
   - Bạn **BẮT BUỘC** phải gọi lệnh thông qua file `.agents/skills/db-migrate/scripts/typeorm-runner.sh` để hệ thống tự handle env, backup và pooler guard.
3. **Ưu tiên Bun:**
   - Bất cứ lệnh chạy nào ngoài file runner, nếu cần phải ưu tiên dùng `bun` hoặc `bunx`.
4. **Dọn dẹp Code & Script thừa sau khi migrate:**
   - Sau khi hoàn thành quá trình migrate, bạn **BẮT BUỘC** phải dọn dẹp các script tạm, file query SQL thử nghiệm, file test kết nối hoặc bất kỳ code rác nào phát sinh trong quá trình xử lý migrate.
   - Chỉ giữ lại các file migration chuẩn trong `src/migrations/` và bản backup tự động trong `.agents/skills/db-migrate/backups/`.
   - Kiểm tra `git status` để đảm bảo workspace sạch sẽ, không để sót file tạm hay thay đổi ngoài ý muốn.

---

## 3. Cách Gọi Script Thực Thi

Sử dụng terminal tool để gọi runner script tại: `.agents/skills/db-migrate/scripts/typeorm-runner.sh`.

### Lệnh Mode 1 (Generate)

```bash
bash .agents/skills/db-migrate/scripts/typeorm-runner.sh generate <TARGET_ENV_FILE> <MIGRATION_NAME>
# Ví dụ: bash .agents/skills/db-migrate/scripts/typeorm-runner.sh generate .env.staging AddUserTable
```

### Lệnh Mode 2 (Run - có tự động backup)

```bash
bash .agents/skills/db-migrate/scripts/typeorm-runner.sh run <TARGET_ENV_FILE>
# Ví dụ: bash .agents/skills/db-migrate/scripts/typeorm-runner.sh run .env.staging
```

### Lệnh Mode 3 (Sync-Schema - CHỈ CẤU TRÚC, GIỮ NGUYÊN DATA)

```bash
bash .agents/skills/db-migrate/scripts/typeorm-runner.sh sync-schema <TARGET_ENV_FILE>
# Ví dụ: bash .agents/skills/db-migrate/scripts/typeorm-runner.sh sync-schema .env.local
```

### Lệnh Mode 4 (Sync Toàn bộ - Cảnh báo: Ghi đè DATA)

```bash
bash .agents/skills/db-migrate/scripts/typeorm-runner.sh sync <SOURCE_ENV_FILE> <TARGET_ENV_FILE>
# Ví dụ: bash .agents/skills/db-migrate/scripts/typeorm-runner.sh sync .env.klotus-production .env.local
```

---

## 4. Hậu Kiểm & Dọn Dẹp (Bắt buộc)

1. **Kiểm tra trạng thái migrate:** Đọc log output để xác nhận việc generate, migrate hoặc sync đã thành công 100% không còn pending.
2. **Dọn dẹp rác & code tạm:**
   - Xóa ngay mọi script thử nghiệm, scratch files, file dump tạm thời ngoài thư mục backups.
   - Revert hoặc dọn dẹp các chỉnh sửa tạm/debug trong source code.
3. **Báo cáo:** Báo cáo lại cho User bằng tiếng Việt gọn gàng, rõ ràng kèm danh sách thay đổi và trạng thái dọn dẹp.

