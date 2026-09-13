import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedBikeBomConfigAndLinkExistingBoms1787000000003 implements MigrationInterface {
  name = 'SeedBikeBomConfigAndLinkExistingBoms1787000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE
        v_cat_id uuid;
        v_color_attr_id uuid;
        v_version_attr_id uuid;
        r RECORD;
        v_color_val text;
        v_version_val text;
      BEGIN
        -- 1. Upsert Category 'BIKE'
        INSERT INTO "erp_bom_categories" (
          "id", "code", "name", "description", "is_active", "is_deleted", "created_at", "updated_at"
        )
        VALUES (
          gen_random_uuid(), 'BIKE', 'Xe máy điện', 'Định mức sản xuất xe máy điện', true, false, NOW(), NOW()
        )
        ON CONFLICT ("code") DO UPDATE
        SET "name" = EXCLUDED."name",
            "description" = EXCLUDED."description",
            "is_active" = true,
            "is_deleted" = false,
            "updated_at" = NOW()
        RETURNING "id" INTO v_cat_id;

        IF v_cat_id IS NULL THEN
          SELECT "id" INTO v_cat_id FROM "erp_bom_categories" WHERE "code" = 'BIKE' LIMIT 1;
        END IF;

        -- 2. Upsert Attribute Def: 'color' (SELECT / Combobox)
        INSERT INTO "erp_bom_attribute_defs" (
          "id", "category_id", "code", "name", "field_type", "options", "sort_order", "is_required", "is_active", "is_deleted", "created_at", "updated_at"
        )
        VALUES (
          gen_random_uuid(),
          v_cat_id,
          'color',
          'Màu sắc',
          'SELECT',
          '[
            {"value": "blue", "label": "Xanh"},
            {"value": "gray", "label": "Xám"},
            {"value": "white", "label": "Trắng"},
            {"value": "red", "label": "Đỏ"},
            {"value": "black", "label": "Đen"},
            {"value": "matte_black", "label": "Đen nhám"},
            {"value": "glossy_black", "label": "Đen bóng"},
            {"value": "dark_matte_gray", "label": "Xám nhám đậm"},
            {"value": "glossy_cement_gray", "label": "Xám xi măng bóng"}
          ]'::jsonb,
          1,
          true,
          true,
          false,
          NOW(),
          NOW()
        )
        ON CONFLICT ("category_id", "code") DO UPDATE
        SET "name" = EXCLUDED."name",
            "field_type" = EXCLUDED."field_type",
            "options" = EXCLUDED."options",
            "sort_order" = EXCLUDED."sort_order",
            "is_required" = EXCLUDED."is_required",
            "is_active" = true,
            "is_deleted" = false,
            "updated_at" = NOW()
        RETURNING "id" INTO v_color_attr_id;

        IF v_color_attr_id IS NULL THEN
          SELECT "id" INTO v_color_attr_id FROM "erp_bom_attribute_defs" WHERE "category_id" = v_cat_id AND "code" = 'color' LIMIT 1;
        END IF;

        -- 3. Upsert Attribute Def: 'version' (NUMBER)
        INSERT INTO "erp_bom_attribute_defs" (
          "id", "category_id", "code", "name", "field_type", "options", "sort_order", "is_required", "is_active", "is_deleted", "created_at", "updated_at"
        )
        VALUES (
          gen_random_uuid(),
          v_cat_id,
          'version',
          'Phiên bản',
          'NUMBER',
          NULL,
          2,
          false,
          true,
          false,
          NOW(),
          NOW()
        )
        ON CONFLICT ("category_id", "code") DO UPDATE
        SET "name" = EXCLUDED."name",
            "field_type" = EXCLUDED."field_type",
            "options" = EXCLUDED."options",
            "sort_order" = EXCLUDED."sort_order",
            "is_required" = EXCLUDED."is_required",
            "is_active" = true,
            "is_deleted" = false,
            "updated_at" = NOW()
        RETURNING "id" INTO v_version_attr_id;

        IF v_version_attr_id IS NULL THEN
          SELECT "id" INTO v_version_attr_id FROM "erp_bom_attribute_defs" WHERE "category_id" = v_cat_id AND "code" = 'version' LIMIT 1;
        END IF;

        -- 4. Gán category_id cho các BOM hiện tại
        UPDATE "erp_boms"
        SET "category_id" = v_cat_id
        WHERE "is_deleted" = false AND ("category_id" IS NULL OR "category_id" = v_cat_id);

        -- 5. Duyệt qua từng BOM để trích xuất màu và gán attribute_values
        FOR r IN SELECT "id", "bom_code", "bom_name", "version" FROM "erp_boms" WHERE "is_deleted" = false
        LOOP
          v_color_val := NULL;
          IF r.bom_name ILIKE '%(Đen nhám)%' OR r.bom_code ILIKE '%-DEN-NHAM%' THEN
            v_color_val := 'matte_black';
          ELSIF r.bom_name ILIKE '%(Đen bóng)%' OR r.bom_code ILIKE '%-DEN-BONG%' THEN
            v_color_val := 'glossy_black';
          ELSIF r.bom_name ILIKE '%(Xám nhám đậm)%' OR r.bom_code ILIKE '%-XAM-NHAM%' THEN
            v_color_val := 'dark_matte_gray';
          ELSIF r.bom_name ILIKE '%(Xám xi măng bóng)%' OR r.bom_code ILIKE '%-XI-MANG%' THEN
            v_color_val := 'glossy_cement_gray';
          ELSIF r.bom_name ILIKE '%(Xanh)%' OR r.bom_code ILIKE '%-XANH%' THEN
            v_color_val := 'blue';
          ELSIF r.bom_name ILIKE '%(Xám)%' OR r.bom_code ILIKE '%-XAM%' THEN
            v_color_val := 'gray';
          ELSIF r.bom_name ILIKE '%(Trắng)%' OR r.bom_code ILIKE '%-TRANG%' THEN
            v_color_val := 'white';
          ELSIF r.bom_name ILIKE '%(Đỏ)%' OR r.bom_code ILIKE '%-DO%' THEN
            v_color_val := 'red';
          ELSIF r.bom_name ILIKE '%(Đen)%' OR r.bom_code ILIKE '%-DEN%' THEN
            v_color_val := 'black';
          END IF;

          v_version_val := COALESCE(r.version, '1.0');

          -- Gán thuộc tính color nếu có
          IF v_color_val IS NOT NULL THEN
            INSERT INTO "erp_bom_attribute_values" ("id", "bom_id", "attr_def_id", "value_text", "created_at", "updated_at")
            VALUES (gen_random_uuid(), r.id, v_color_attr_id, v_color_val, NOW(), NOW())
            ON CONFLICT ("bom_id", "attr_def_id") DO UPDATE
            SET "value_text" = EXCLUDED."value_text", "updated_at" = NOW();
          END IF;

          -- Gán thuộc tính version
          IF v_version_val IS NOT NULL THEN
            INSERT INTO "erp_bom_attribute_values" ("id", "bom_id", "attr_def_id", "value_text", "created_at", "updated_at")
            VALUES (gen_random_uuid(), r.id, v_version_attr_id, v_version_val, NOW(), NOW())
            ON CONFLICT ("bom_id", "attr_def_id") DO UPDATE
            SET "value_text" = EXCLUDED."value_text", "updated_at" = NOW();
          END IF;
        END LOOP;

      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE
        v_cat_id uuid;
      BEGIN
        SELECT "id" INTO v_cat_id FROM "erp_bom_categories" WHERE "code" = 'BIKE' LIMIT 1;
        IF v_cat_id IS NOT NULL THEN
          UPDATE "erp_boms" SET "category_id" = NULL WHERE "category_id" = v_cat_id;
          DELETE FROM "erp_bom_attribute_values" WHERE "attr_def_id" IN (
            SELECT "id" FROM "erp_bom_attribute_defs" WHERE "category_id" = v_cat_id
          );
          DELETE FROM "erp_bom_attribute_defs" WHERE "category_id" = v_cat_id;
          DELETE FROM "erp_bom_categories" WHERE "id" = v_cat_id;
        END IF;
      END $$;
    `);
  }
}
