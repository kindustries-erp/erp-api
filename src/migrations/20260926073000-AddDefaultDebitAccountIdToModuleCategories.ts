import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDefaultDebitAccountIdToModuleCategories20260926073000 implements MigrationInterface {
  name = 'AddDefaultDebitAccountIdToModuleCategories20260926073000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Thêm cột default_debit_account_id vào erp_module_categories
    await queryRunner.query(`
      ALTER TABLE erp_module_categories
        ADD COLUMN IF NOT EXISTS default_debit_account_id UUID DEFAULT NULL;
    `);

    // 2. Thêm Foreign Key constraint tham chiếu sang erp_chart_of_accounts
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_module_cat_default_debit_account'
        ) THEN
          ALTER TABLE erp_module_categories
            ADD CONSTRAINT fk_module_cat_default_debit_account
            FOREIGN KEY (default_debit_account_id)
            REFERENCES erp_chart_of_accounts(id)
            ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    // 3. Tạo Index tối ưu hóa JOIN
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_module_cat_default_debit_account
        ON erp_module_categories(default_debit_account_id);
    `);

    // 4. Bổ sung Comment ghi chú
    await queryRunner.query(`
      COMMENT ON COLUMN erp_module_categories.default_debit_account_id
        IS 'FK -> erp_chart_of_accounts. TK Nợ mặc định khi hạch toán hóa đơn. NULL = dùng static TT99 map hoặc fallback T0003.';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_module_cat_default_debit_account;
    `);

    await queryRunner.query(`
      ALTER TABLE erp_module_categories
        DROP CONSTRAINT IF EXISTS fk_module_cat_default_debit_account,
        DROP COLUMN IF EXISTS default_debit_account_id;
    `);
  }
}
