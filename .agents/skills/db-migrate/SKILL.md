---
name: db-migrate
description: Skill hỗ trợ Agent phân loại ý định (generate schema, run migrate, clone/sync data) và gọi runner TypeORM chuẩn cho dự án erp-api, có guard cho Neon pooler URL, backup trước khi apply schema và runbook migrate Production DB sang cơ chế Module Config mới.
---

# Hướng dẫn DB Migrate & Production Runbook (`erp-api`)

Dự án `erp-api` sử dụng TypeORM (`src/db/data-source.cli.ts`) và lưu file migration tại `src/migrations/`.
Bất cứ khi nào làm việc với Database liên quan đến migration hay copy/sync dữ liệu, bạn **PHẢI** tuân theo các quy tắc nghiêm ngặt dưới đây.

---

## 0. Quy tắc Database Connection & Neon URL (Bắt buộc)

- **Ưu tiên `DATABASE_URL`:** Runner đọc `DATABASE_URL` từ file `.env` chỉ định.
- **Fallback `DB_HOST` / `DB_PORT`:** Nếu file `.env` không có `DATABASE_URL` nhưng có cấu hình `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_DATABASE`, `DB_SSL`, runner sẽ tự động ghép chuỗi kết nối chuẩn `postgresql://USER:PASS@HOST:PORT/DB?sslmode=...`.
- **Neon Pooler Guard:** Nếu URL kết nối đến Neon host chứa `-pooler` thì runner tự động chuẩn hóa:
  - `ep-xxx-pooler...` ➔ `ep-xxx...`
  - Bỏ `channel_binding=require` khỏi query string nếu có.
- **Lý do:** Tránh lỗi ngắt kết nối/transaction khi chạy DDL qua pooler và hỗ trợ linh hoạt cả môi trường Neon cloud lẫn PostgreSQL nội bộ / local (`DB_HOST`).

---

## 1. Xác định Intent (4 Mode Hoạt Động)

Dựa vào câu lệnh của User, tự suy luận xem họ đang cần ở Mode nào:

- **Mode 1 (generate): `db-schema-migrate`**
  - **Dấu hiệu:** "Tạo file migration cho bảng X", "generate schema", "diff db", "sửa Entity xong rồi"...
  - **Mục đích:** So sánh code Typescript (Entities) với Database đích để sinh ra file `.ts` chứa SQL. Database chưa thay đổi.

- **Mode 2 (run): `db-migrate`**
  - **Dấu hiệu:** "Chạy migration", "apply file migration vào DB", "update cấu trúc bảng"...
  - **Mục đích:** Chạy các file `.ts` đang có vào trong Database. Kịch bản chạy sẽ tự động backup DB trước khi apply.

- **Mode 3 (sync-schema): `db-sync-schema`**
  - **Dấu hiệu:** "Migrate db schema từ code sang local", "Update schema local giống prod", "Đồng bộ schema giữ nguyên data"...
  - **Mục đích:** Dùng `TypeORM schema:sync` để tự động đối chiếu Code (Entities) hiện tại và sinh ra lệnh `ALTER TABLE` chạy vào Target DB. An toàn và không gây mất data cũ.

- **Mode 4 (sync): `db-clone` / `db-sync`**
  - **Dấu hiệu:** "Đồng bộ DB từ X sang Y", "Copy toàn bộ DB prod về local", "Đồng bộ cả data"...
  - **Mục đích:** Dùng `pg_dump` và `pg_restore` để copy nguyên bản cấu trúc + DATA (rất nặng và ghi đè toàn bộ data) giữa 2 DB.

---

## 2. Quy Tắc Bắt Buộc

1. **Luôn Xác Nhận Môi Trường (Env Files):**
   - Không bao giờ được chạy ngầm. Phải xác định rõ file `.env.*` làm TARGET (ví dụ: `.env.production`, `.env.staging`, `.env.local`).
2. **Không tự gọi TypeORM trực tiếp:**
   - Bạn **BẮT BUỘC** phải gọi lệnh thông qua file `.agents/skills/db-migrate/scripts/typeorm-runner.sh` để hệ thống tự handle env, backup và pooler guard.
3. **Ưu tiên Bun:**
   - Dùng `bun` hoặc `bunx` độc quyền.
4. **Dọn dẹp Code & Script thừa sau khi migrate:**
   - Xóa ngay mọi script thử nghiệm, scratch files, file dump tạm thời ngoài thư mục backups.
   - Chỉ giữ lại các file migration chuẩn trong `src/migrations/` và bản backup tự động trong `.agents/skills/db-migrate/backups/`.

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
# Ví dụ: bash .agents/skills/db-migrate/scripts/typeorm-runner.sh sync .env.production .env.local
```

---

## 4. Hướng dẫn Viết Migration EAV Mới (Idempotent Standard)

Khi tạo file migration mới để khai báo thêm thuộc tính hoặc backfill dữ liệu cho phân hệ:

### Bước 1: Seed / Upsert Định nghĩa Thuộc tính (`erp_module_attribute_defs`)
```typescript
await queryRunner.query(`
  INSERT INTO "erp_module_attribute_defs" (
    "id", "category_id", "code", "name", "name_en", "field_type",
    "options", "sort_order", "is_required", "is_deleted", "is_active",
    "is_global", "module_key_global", "is_system", "created_at", "updated_at"
  )
  SELECT 
    gen_random_uuid(), NULL, 'type_my_module', 'Loại nghiệp vụ', 'Business Type', 'SELECT',
    $1::jsonb, 0, false, false, true,
    true, 'MY_MODULE_KEY', true, now(), now()
  WHERE NOT EXISTS (
    SELECT 1 FROM "erp_module_attribute_defs"
    WHERE is_deleted = false 
      AND is_global = true 
      AND module_key_global = 'MY_MODULE_KEY' 
      AND code = 'type_my_module'
  );
`, [
  JSON.stringify([
    { value: 'TYPE_A', label: 'Loại A', labelEn: 'Type A', labels: { vi: 'Loại A', en: 'Type A' } },
    { value: 'TYPE_B', label: 'Loại B', labelEn: 'Type B', labels: { vi: 'Loại B', en: 'Type B' } },
  ])
]);
```

### Bước 2: Backfill Dữ liệu Thực tế (`erp_entity_attribute_values`)
```typescript
const [attrDef] = await queryRunner.query(`
  SELECT id FROM "erp_module_attribute_defs"
  WHERE is_deleted = false 
    AND is_global = true 
    AND module_key_global = 'MY_MODULE_KEY' 
    AND code = 'type_my_module'
  LIMIT 1;
`);

if (attrDef?.id) {
  await queryRunner.query(`
    INSERT INTO "erp_entity_attribute_values" (
      "id", "entity_type", "entity_id", "attr_def_id", "value_text", "created_at", "updated_at"
    )
    SELECT 
      gen_random_uuid(),
      'MY_MODULE_KEY',
      e.id,
      $1,
      COALESCE(e.legacy_type_column, 'TYPE_A'),
      now(),
      now()
    FROM "erp_my_entities" e
    WHERE e.is_deleted = false
      AND NOT EXISTS (
        SELECT 1 FROM "erp_entity_attribute_values" eav
        WHERE eav.entity_type = 'MY_MODULE_KEY'
          AND eav.entity_id = e.id
          AND eav.attr_def_id = $1
      );
  `, [attrDef.id]);
}
```

---

## 5. 🚀 RUNBOOK: Migrate Production DB sang Cơ chế Module Config Mới

Dưới đây là quy trình chuẩn từng bước để tiến hành migrate CSDL Production sang phân hệ `module-config` mới, đảm bảo **Zero Data Loss**, **Zero Downtime**, và **Idempotent**.

### 5.1. Danh Sách Migration Tuần Tự Trong Codebase

1. `src/migrations/1788700000000-CleanInvoiceInCustomAttributes.ts`
   - Dọn dẹp trường `custom_attributes` dạng JSON trên bảng Hóa đơn nếu có.
2. `src/migrations/20260907190000-MigrateAndHarmonizeEntityCustomAttributes.ts`
   - Tạo bảng EAV đa module `erp_entity_attribute_values`.
   - Seed thuộc tính mặc định (`is_system = true`, `is_global = true`) cho các phân hệ: `GOODS_RECEIPT`, `GOODS_ISSUE`, `INVENTORY_ADJUSTMENT`, `INVOICE_IN`, `INVOICE_OUT`.
   - Di chuyển toàn bộ dữ liệu lịch sử từ các bảng gốc sang `erp_entity_attribute_values`.
3. `src/migrations/20260907200000-RenameBomConfigTablesToModuleConfig.ts`
   - Đổi tên bảng `erp_bom_categories` ➔ `erp_module_categories`.
   - Đổi tên bảng `erp_bom_attribute_defs` ➔ `erp_module_attribute_defs`.
   - Cập nhật các quan hệ khóa ngoại (Foreign Keys) và Indexes.
   - Drop an toàn bảng thừa legacy `erp_bom_attribute_values` (dữ liệu BOM đã chuyển sang `erp_entity_attribute_values`).

---

### 5.2. Các Bước Thực Thi Trên Production

#### Bước 1: Tiền kiểm tra & Backup CSDL
```bash
# 1. Chạy runner tự động tạo backup snapshot
bash .agents/skills/db-migrate/scripts/typeorm-runner.sh run .env.production
```
*(Script sẽ tự động chạy `pg_dump` tạo file `.sql` nén trong thư mục `.agents/skills/db-migrate/backups/` trước khi áp dụng bất kỳ lệnh DDL nào).*

#### Bước 2: Kiểm tra danh sách Pending Migrations
```bash
cd /home/dev/repos/erp/erp-api && bun run migration:show
```
Xác nhận có 3 migrations trên đang ở trạng thái `[ ]` (chưa chạy).

#### Bước 3: Áp dụng Migration vào Production
```bash
cd /home/dev/repos/erp/erp-api && bun run migration:run
```

---

### 5.3. Bảng Kiểm Tra Hậu Kiểm Nghiệm Thu (Post-Flight SQL Checklist)

Sau khi migration hoàn tất, chạy các câu lệnh SQL sau trên Production Database để nghiệm thu:

#### 1. Kiểm tra Bảng Danh mục Module (`erp_module_categories`)
```sql
SELECT module_key, count(*) as total_categories
FROM erp_module_categories 
WHERE is_deleted = false
GROUP BY module_key;
```
*Kỳ vọng:* Trả về số lượng danh mục đầy đủ cho các phân hệ `BOM`, `INVOICE`, `BANK_TXN`...

#### 2. Kiểm tra Bảng Định nghĩa Thuộc tính (`erp_module_attribute_defs`)
```sql
SELECT 
  module_key_global, 
  code, 
  name, 
  field_type, 
  is_system, 
  is_global
FROM erp_module_attribute_defs
WHERE is_deleted = false
ORDER BY module_key_global, sort_order;
```
*Kỳ vọng:* Hiển thị đủ các thuộc tính mặc định: `type_inventory_receipt`, `type_inventory_issue`, `type_inventory_adjustment`, `type_invoice_in`, `type_invoice_out`, `color`, `version`...

#### 3. Kiểm tra Dữ liệu Thực tế (`erp_entity_attribute_values`)
```sql
SELECT entity_type, count(*) as total_records
FROM erp_entity_attribute_values
GROUP BY entity_type;
```
*Kỳ vọng:* Dữ liệu của `BOM`, `GOODS_RECEIPT`, `GOODS_ISSUE`, `INVOICE_IN`, `INVOICE_OUT` đã được backfill chuẩn xác sang EAV.

#### 4. Kiểm tra Không Còn Bảng Legacy Thừa
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('erp_bom_categories', 'erp_bom_attribute_defs', 'erp_bom_attribute_values');
```
*Kỳ vọng:* Kết quả rỗng (0 dòng) — các bảng legacy đã được đổi tên và thay thế sạch sẽ.
