import { MigrationInterface, QueryRunner } from 'typeorm';

export class StandardizeVinfastSkuPrefix1786500000000 implements MigrationInterface {
  name = 'StandardizeVinfastSkuPrefix1786500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop existing FK constraint without ON UPDATE CASCADE if exists
    await queryRunner.query(`
      ALTER TABLE "vinfast_parts_ledger" 
      DROP CONSTRAINT IF EXISTS "FK_5e3639f167165989d93fbdb0e6e";
    `);

    // 2. Update ledger references to VF- prefix first
    await queryRunner.query(`
      UPDATE "vinfast_parts_ledger"
      SET "part_sku" = 'VF-' || "part_sku"
      WHERE "part_sku" NOT LIKE 'VF-%';
    `);

    // 3. Delete legacy non-VF catalog entries where VF- counterpart already exists
    await queryRunner.query(`
      DELETE FROM "vinfast_parts_catalog"
      WHERE "sku" NOT LIKE 'VF-%'
        AND 'VF-' || "sku" IN (SELECT "sku" FROM "vinfast_parts_catalog" WHERE "sku" LIKE 'VF-%');
    `);

    // 4. Update remaining catalog SKUs with VF- prefix
    await queryRunner.query(`
      UPDATE "vinfast_parts_catalog"
      SET "sku" = 'VF-' || "sku"
      WHERE "sku" NOT LIKE 'VF-%';
    `);

    // 5. Ensure any referenced ledger SKUs exist in catalog before creating FK
    await queryRunner.query(`
      INSERT INTO "vinfast_parts_catalog" ("sku", "name", "uom", "created_at", "updated_at")
      SELECT DISTINCT l."part_sku", l."part_sku", 'Cái', NOW(), NOW()
      FROM "vinfast_parts_ledger" l
      LEFT JOIN "vinfast_parts_catalog" c ON c."sku" = l."part_sku"
      WHERE c."sku" IS NULL
      ON CONFLICT ("sku") DO NOTHING;
    `);

    // 6. Re-create FK with ON UPDATE CASCADE ON DELETE CASCADE
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "vinfast_parts_ledger" 
        ADD CONSTRAINT "FK_5e3639f167165989d93fbdb0e6e" 
        FOREIGN KEY ("part_sku") 
        REFERENCES "vinfast_parts_catalog"("sku") 
        ON DELETE CASCADE 
        ON UPDATE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop FK constraint
    await queryRunner.query(`
      ALTER TABLE "vinfast_parts_ledger" 
      DROP CONSTRAINT IF EXISTS "FK_5e3639f167165989d93fbdb0e6e";
    `);

    // 2. Revert ledger part_sku
    await queryRunner.query(`
      UPDATE "vinfast_parts_ledger"
      SET "part_sku" = SUBSTRING("part_sku" FROM 4)
      WHERE "part_sku" LIKE 'VF-%';
    `);

    // 3. Delete VF- catalog entries where non-VF counterpart already exists
    await queryRunner.query(`
      DELETE FROM "vinfast_parts_catalog"
      WHERE "sku" LIKE 'VF-%'
        AND SUBSTRING("sku" FROM 4) IN (SELECT "sku" FROM "vinfast_parts_catalog" WHERE "sku" NOT LIKE 'VF-%');
    `);

    // 4. Revert catalog sku
    await queryRunner.query(`
      UPDATE "vinfast_parts_catalog"
      SET "sku" = SUBSTRING("sku" FROM 4)
      WHERE "sku" LIKE 'VF-%';
    `);

    // 5. Ensure referenced SKUs exist
    await queryRunner.query(`
      INSERT INTO "vinfast_parts_catalog" ("sku", "name", "uom", "created_at", "updated_at")
      SELECT DISTINCT l."part_sku", l."part_sku", 'Cái', NOW(), NOW()
      FROM "vinfast_parts_ledger" l
      LEFT JOIN "vinfast_parts_catalog" c ON c."sku" = l."part_sku"
      WHERE c."sku" IS NULL
      ON CONFLICT ("sku") DO NOTHING;
    `);

    // 6. Re-create FK constraint with NO ACTION
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "vinfast_parts_ledger" 
        ADD CONSTRAINT "FK_5e3639f167165989d93fbdb0e6e" 
        FOREIGN KEY ("part_sku") 
        REFERENCES "vinfast_parts_catalog"("sku") 
        ON DELETE NO ACTION 
        ON UPDATE NO ACTION;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
  }
}
