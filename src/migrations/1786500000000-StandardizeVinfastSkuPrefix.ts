import { MigrationInterface, QueryRunner } from 'typeorm';

export class StandardizeVinfastSkuPrefix1786500000000 implements MigrationInterface {
  name = 'StandardizeVinfastSkuPrefix1786500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop existing FK constraint without ON UPDATE CASCADE if exists
    await queryRunner.query(`
      ALTER TABLE "vinfast_parts_ledger" 
      DROP CONSTRAINT IF EXISTS "FK_5e3639f167165989d93fbdb0e6e";
    `);

    // 2. Re-create FK with ON UPDATE CASCADE ON DELETE CASCADE
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

    // 3. Update existing catalog SKUs with VF- prefix
    await queryRunner.query(`
      UPDATE "vinfast_parts_catalog"
      SET "sku" = 'VF-' || "sku"
      WHERE "sku" NOT LIKE 'VF-%';
    `);

    // 4. Update existing ledger part_sku with VF- prefix (if not automatically cascaded or if standalone)
    await queryRunner.query(`
      UPDATE "vinfast_parts_ledger"
      SET "part_sku" = 'VF-' || "part_sku"
      WHERE "part_sku" NOT LIKE 'VF-%';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Revert ledger part_sku
    await queryRunner.query(`
      UPDATE "vinfast_parts_ledger"
      SET "part_sku" = SUBSTRING("part_sku" FROM 4)
      WHERE "part_sku" LIKE 'VF-%';
    `);

    // 2. Revert catalog sku
    await queryRunner.query(`
      UPDATE "vinfast_parts_catalog"
      SET "sku" = SUBSTRING("sku" FROM 4)
      WHERE "sku" LIKE 'VF-%';
    `);

    // 3. Revert FK constraint
    await queryRunner.query(`
      ALTER TABLE "vinfast_parts_ledger" 
      DROP CONSTRAINT IF EXISTS "FK_5e3639f167165989d93fbdb0e6e";
    `);

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
