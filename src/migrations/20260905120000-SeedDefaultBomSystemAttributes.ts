import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedDefaultBomSystemAttributes20260905120000 implements MigrationInterface {
  name = 'SeedDefaultBomSystemAttributes20260905120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Định nghĩa danh sách tùy chọn song ngữ chuẩn cho thuộc tính Màu sắc
    const defaultColorOptions = JSON.stringify([
      {
        value: 'blue',
        label: 'Xanh',
        labelEn: 'Blue',
        labels: { vi: 'Xanh', en: 'Blue' },
      },
      {
        value: 'gray',
        label: 'Xám',
        labelEn: 'Gray',
        labels: { vi: 'Xám', en: 'Gray' },
      },
      {
        value: 'white',
        label: 'Trắng',
        labelEn: 'White',
        labels: { vi: 'Trắng', en: 'White' },
      },
      {
        value: 'red',
        label: 'Đỏ',
        labelEn: 'Red',
        labels: { vi: 'Đỏ', en: 'Red' },
      },
      {
        value: 'black',
        label: 'Đen',
        labelEn: 'Black',
        labels: { vi: 'Đen', en: 'Black' },
      },
      {
        value: 'matte_black',
        label: 'Đen nhám',
        labelEn: 'Matte Black',
        labels: { vi: 'Đen nhám', en: 'Matte Black' },
      },
      {
        value: 'glossy_black',
        label: 'Đen bóng',
        labelEn: 'Glossy Black',
        labels: { vi: 'Đen bóng', en: 'Glossy Black' },
      },
      {
        value: 'dark_matte_gray',
        label: 'Xám nhám đậm',
        labelEn: 'Dark Matte Gray',
        labels: { vi: 'Xám nhám đậm', en: 'Dark Matte Gray' },
      },
      {
        value: 'glossy_cement_gray',
        label: 'Xám xi măng bóng',
        labelEn: 'Glossy Cement Gray',
        labels: { vi: 'Xám xi măng bóng', en: 'Glossy Cement Gray' },
      },
    ]);

    // 2. BOM: Upsert thuộc tính mặc định hệ thống 'color' (SELECT)
    const existingColor = await queryRunner.query(`
      SELECT id, code, options FROM "erp_bom_attribute_defs"
      WHERE "module_key_global" = 'BOM'
        AND "is_global" = true
        AND "is_deleted" = false
        AND "code" = 'color'
      LIMIT 1;
    `);

    if (existingColor && existingColor.length > 0) {
      await queryRunner.query(
        `
        UPDATE "erp_bom_attribute_defs"
        SET "is_system" = true,
            "name" = 'Màu sắc',
            "name_en" = 'Color',
            "field_type" = 'SELECT',
            "options" = $1::jsonb,
            "sort_order" = 1,
            "updated_at" = NOW()
        WHERE "id" = $2;
      `,
        [defaultColorOptions, existingColor[0].id],
      );
    } else {
      await queryRunner.query(
        `
        INSERT INTO "erp_bom_attribute_defs" (
          "id", "is_global", "module_key_global", "code", "name", "name_en",
          "field_type", "options", "sort_order", "is_required", "is_active", "is_system", "is_deleted",
          "created_at", "updated_at"
        ) VALUES (
          gen_random_uuid(), true, 'BOM', 'color', 'Màu sắc', 'Color',
          'SELECT', $1::jsonb, 1, false, true, true, false,
          NOW(), NOW()
        );
      `,
        [defaultColorOptions],
      );
    }

    // 3. BOM: Upsert thuộc tính mặc định hệ thống 'version' (NUMBER)
    const existingVersion = await queryRunner.query(`
      SELECT id, code FROM "erp_bom_attribute_defs"
      WHERE "module_key_global" = 'BOM'
        AND "is_global" = true
        AND "is_deleted" = false
        AND "code" = 'version'
      LIMIT 1;
    `);

    if (existingVersion && existingVersion.length > 0) {
      await queryRunner.query(
        `
        UPDATE "erp_bom_attribute_defs"
        SET "is_system" = true,
            "name" = 'Phiên bản',
            "name_en" = 'Version',
            "field_type" = 'NUMBER',
            "options" = NULL,
            "sort_order" = 2,
            "updated_at" = NOW()
        WHERE "id" = $1;
      `,
        [existingVersion[0].id],
      );
    } else {
      await queryRunner.query(`
        INSERT INTO "erp_bom_attribute_defs" (
          "id", "is_global", "module_key_global", "code", "name", "name_en",
          "field_type", "options", "sort_order", "is_required", "is_active", "is_system", "is_deleted",
          "created_at", "updated_at"
        ) VALUES (
          gen_random_uuid(), true, 'BOM', 'version', 'Phiên bản', 'Version',
          'NUMBER', NULL, 2, false, true, true, false,
          NOW(), NOW()
        );
      `);
    }

    // 4. Backfill dữ liệu từ erp_bom_attribute_values & erp_boms.version sang erp_entity_attribute_values
    await queryRunner.query(`
      DO $$
      DECLARE
        v_color_def_id uuid;
        v_version_def_id uuid;
      BEGIN
        SELECT "id" INTO v_color_def_id FROM "erp_bom_attribute_defs"
        WHERE "module_key_global" = 'BOM' AND "is_global" = true AND "code" = 'color' AND "is_deleted" = false LIMIT 1;

        SELECT "id" INTO v_version_def_id FROM "erp_bom_attribute_defs"
        WHERE "module_key_global" = 'BOM' AND "is_global" = true AND "code" = 'version' AND "is_deleted" = false LIMIT 1;

        -- Backfill color
        IF v_color_def_id IS NOT NULL THEN
          INSERT INTO "erp_entity_attribute_values" ("id", "entity_type", "entity_id", "category_id", "attr_def_id", "value_text", "created_at", "updated_at")
          SELECT
            gen_random_uuid(),
            'BOM',
            b."bom_id",
            NULL,
            v_color_def_id,
            b."value_text",
            NOW(),
            NOW()
          FROM "erp_bom_attribute_values" b
          JOIN "erp_bom_attribute_defs" def ON def."id" = b."attr_def_id"
          WHERE def."code" = 'color'
          ON CONFLICT ("entity_type", "entity_id", "attr_def_id") DO UPDATE
          SET "value_text" = EXCLUDED."value_text", "updated_at" = NOW();
        END IF;

        -- Backfill version (ưu tiên từ bom_attribute_values, fallback sang erp_boms.version, fallback sang '1.0')
        IF v_version_def_id IS NOT NULL THEN
          INSERT INTO "erp_entity_attribute_values" ("id", "entity_type", "entity_id", "category_id", "attr_def_id", "value_text", "created_at", "updated_at")
          SELECT
            gen_random_uuid(),
            'BOM',
            bom."id",
            NULL,
            v_version_def_id,
            COALESCE(
              (SELECT bav."value_text" FROM "erp_bom_attribute_values" bav JOIN "erp_bom_attribute_defs" d ON d."id" = bav."attr_def_id" WHERE bav."bom_id" = bom."id" AND d."code" = 'version' LIMIT 1),
              bom."version",
              '1.0'
            ),
            NOW(),
            NOW()
          FROM "erp_boms" bom
          WHERE bom."is_deleted" = false
          ON CONFLICT ("entity_type", "entity_id", "attr_def_id") DO UPDATE
          SET "value_text" = EXCLUDED."value_text", "updated_at" = NOW();
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE
        v_color_def_id uuid;
        v_version_def_id uuid;
      BEGIN
        SELECT "id" INTO v_color_def_id FROM "erp_bom_attribute_defs"
        WHERE "module_key_global" = 'BOM' AND "is_global" = true AND "code" = 'color' LIMIT 1;

        SELECT "id" INTO v_version_def_id FROM "erp_bom_attribute_defs"
        WHERE "module_key_global" = 'BOM' AND "is_global" = true AND "code" = 'version' LIMIT 1;

        IF v_color_def_id IS NOT NULL THEN
          DELETE FROM "erp_entity_attribute_values" WHERE "entity_type" = 'BOM' AND "attr_def_id" = v_color_def_id;
          DELETE FROM "erp_bom_attribute_defs" WHERE "id" = v_color_def_id;
        END IF;

        IF v_version_def_id IS NOT NULL THEN
          DELETE FROM "erp_entity_attribute_values" WHERE "entity_type" = 'BOM' AND "attr_def_id" = v_version_def_id;
          DELETE FROM "erp_bom_attribute_defs" WHERE "id" = v_version_def_id;
        END IF;
      END $$;
    `);
  }
}
