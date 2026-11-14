import { MigrationInterface, QueryRunner } from 'typeorm';
import { normalizeVietnamese } from '../v2/core/base-core/helpers/text-normalize.util';
import {
  itemTypeOfCode,
  normalizeItemCode,
} from '../v2/modules/items-garage/helpers/garage-item-code.helper';

/**
 * Tạo danh mục mã hàng garage `items_garage` và nạp sẵn các mã đang dùng
 * (tồn kho, phiếu nhập, đề nghị mua, đơn mua của garage). Nạp idempotent: mã đã có thì bỏ qua.
 * Thứ tự nguồn quyết định tên/ĐVT được giữ khi một mã xuất hiện ở nhiều nơi.
 * down() xóa bảng.
 */
const SEED_SOURCES: readonly { table: string; unit: boolean }[] = [
  { table: 'garage_stock_balances', unit: true },
  { table: 'inventory_balances_garage', unit: true },
  { table: 'goods_receipt_lines_garage', unit: true },
  { table: 'proc_order_lines_garage', unit: false },
  { table: 'proc_request_lines_garage', unit: false },
];

interface SeedRow {
  item_code: string;
  item_name: string;
  unit: string | null;
}

export class CreateItemsGarage20261112150000 implements MigrationInterface {
  name = 'CreateItemsGarage20261112150000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "items_garage" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "extra_data" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "is_deleted" boolean NOT NULL DEFAULT false,
        "item_code" character varying(128) NOT NULL,
        "item_name" character varying(255) NOT NULL,
        "name_normalized" character varying(255) NOT NULL,
        "unit" character varying(50),
        "item_type" character varying(16),
        "source" character varying(16) NOT NULL DEFAULT 'MANUAL',
        "is_active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_items_garage_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_items_garage_item_code" ON "items_garage" ("item_code") WHERE "is_deleted" = false`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_items_garage_name_normalized" ON "items_garage" ("name_normalized")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_items_garage_is_deleted" ON "items_garage" ("is_deleted")`,
    );

    const seen = new Set<string>();
    for (const source of SEED_SOURCES) {
      if (!(await queryRunner.hasTable(source.table))) continue;
      const rows: SeedRow[] = await queryRunner.query(
        `SELECT DISTINCT ON (upper(btrim("item_code")))
           "item_code", "item_name", ${source.unit ? '"unit"' : 'NULL::varchar AS "unit"'}
         FROM "${source.table}"
         WHERE coalesce(btrim("item_code"), '') <> '' AND coalesce(btrim("item_name"), '') <> ''
         ORDER BY upper(btrim("item_code")), "created_at" DESC`,
      );
      for (const row of rows) {
        const code = normalizeItemCode(row.item_code);
        const name = row.item_name.replace(/\s+/g, ' ').trim();
        if (!code || !name || seen.has(code)) continue;
        seen.add(code);
        await queryRunner.query(
          `INSERT INTO "items_garage"
             ("item_code", "item_name", "name_normalized", "unit", "item_type", "source")
           SELECT $1::varchar, $2::varchar, $3::varchar, $4::varchar, $5::varchar, 'SEED'
           WHERE NOT EXISTS (
             SELECT 1 FROM "items_garage" WHERE "item_code" = $1::varchar AND "is_deleted" = false
           )`,
          [
            code,
            name.slice(0, 255),
            normalizeVietnamese(name).slice(0, 255),
            row.unit?.trim() || null,
            itemTypeOfCode(code),
          ],
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "items_garage"`);
  }
}
