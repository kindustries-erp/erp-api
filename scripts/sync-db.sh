#!/bin/bash
# Usage: ./scripts/sync-db.sh <source_env> <target_env>
# Example: ./scripts/sync-db.sh .env .env.klotus-staging

SOURCE_ENV=${1:-.env}
TARGET_ENV=${2:-.env.klotus-staging}

if [ ! -f "$SOURCE_ENV" ] || [ ! -f "$TARGET_ENV" ]; then
    echo "❌ Lỗi: Không tìm thấy file môi trường."
    echo "Sử dụng: bun run db:sync <source_env_file> <target_env_file>"
    echo "Ví dụ: bun run db:sync .env .env.klotus-staging"
    exit 1
fi

# Trích xuất DATABASE_URL từ file .env
SOURCE_URL=$(grep '^DATABASE_URL=' "$SOURCE_ENV" | cut -d '=' -f 2- | tr -d '"' | tr -d "'")
TARGET_URL=$(grep '^DATABASE_URL=' "$TARGET_ENV" | cut -d '=' -f 2- | tr -d '"' | tr -d "'")

if [ -z "$SOURCE_URL" ] || [ -z "$TARGET_URL" ]; then
    echo "❌ Lỗi: Không tìm thấy DATABASE_URL trong một trong hai file môi trường."
    exit 1
fi

echo "============================================================"
echo "🔄 BẮT ĐẦU ĐỒNG BỘ SCHEMA TỪ $SOURCE_ENV SANG $TARGET_ENV"
echo "============================================================"

TIMESTAMP=$(date +%s)
MIGRATION_NAME="src/migrations/AutoSync_$TIMESTAMP"

echo "1️⃣ Tạo TypeORM migration mới từ source database (nếu có code entity thay đổi)..."
DATABASE_URL="$SOURCE_URL" node -r ts-node/register -r tsconfig-paths/register ./node_modules/typeorm/cli.js migration:generate -d src/db/data-source.cli.ts "$MIGRATION_NAME" || true

echo ""
echo "2️⃣ Chạy tất cả TypeORM migrations trên target database ($TARGET_ENV)..."
DATABASE_URL="$TARGET_URL" node -r ts-node/register -r tsconfig-paths/register ./node_modules/typeorm/cli.js migration:run -d src/db/data-source.cli.ts

echo ""
echo "3️⃣ Kiểm tra sự khác biệt (drift) bằng pg_dump..."
pg_dump --schema-only "$SOURCE_URL" > /tmp/source_schema_$TIMESTAMP.sql
pg_dump --schema-only "$TARGET_URL" > /tmp/target_schema_$TIMESTAMP.sql

diff -u /tmp/target_schema_$TIMESTAMP.sql /tmp/source_schema_$TIMESTAMP.sql > /tmp/schema_diff_$TIMESTAMP.txt

if [ -s /tmp/schema_diff_$TIMESTAMP.txt ]; then
    echo "⚠️ CẢNH BÁO: Vẫn còn sự khác biệt giữa hai database schema (Drift)!"
    echo "Điều này xảy ra khi source database bị thay đổi bằng lệnh SQL trực tiếp mà không khai báo trong entities."
    echo "Chi tiết khác biệt được lưu tại: /tmp/schema_diff_$TIMESTAMP.txt"
    echo "Vui lòng xem file trên và viết migration bổ sung nếu cần."
else
    echo "✅ THÀNH CÔNG: Schema của hai database đã hoàn toàn giống nhau."
fi

echo "============================================================"
