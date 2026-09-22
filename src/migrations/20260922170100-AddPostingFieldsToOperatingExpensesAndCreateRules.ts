import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPostingFieldsToOperatingExpensesAndCreateRules20260922170100 implements MigrationInterface {
  name = 'AddPostingFieldsToOperatingExpensesAndCreateRules20260922170100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Thêm các cột hạch toán và liên kết hóa đơn vào erp_operating_expenses
    await queryRunner.query(`
      ALTER TABLE erp_operating_expenses
        ADD COLUMN IF NOT EXISTS posting_status     VARCHAR(20) NOT NULL DEFAULT 'UNPOSTED',
        ADD COLUMN IF NOT EXISTS journal_entry_id   UUID REFERENCES erp_journal_entries(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS accrual_mode       VARCHAR(20) NOT NULL DEFAULT 'NONE',
        ADD COLUMN IF NOT EXISTS linked_invoice_id  UUID REFERENCES erp_invoices(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS settled_at         TIMESTAMPTZ;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_opex_posting_status ON erp_operating_expenses(posting_status);
      CREATE INDEX IF NOT EXISTS idx_opex_linked_invoice  ON erp_operating_expenses(linked_invoice_id);
      CREATE INDEX IF NOT EXISTS idx_opex_accrual_mode    ON erp_operating_expenses(accrual_mode);
    `);

    // 2. Tạo bảng erp_expense_account_rules
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS erp_expense_account_rules (
        id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        category_key                VARCHAR(100) NOT NULL,
        category_label              VARCHAR(255) NOT NULL,
        accrual_mode                VARCHAR(20)  NOT NULL DEFAULT 'NONE',
        direct_debit_account_code   VARCHAR(20)  DEFAULT '6422',
        direct_credit_account_code  VARCHAR(20)  DEFAULT '1121',
        accrual_debit_account_code  VARCHAR(20)  DEFAULT '6422',
        accrual_credit_account_code VARCHAR(20)  DEFAULT '335',
        settle_debit_account_code   VARCHAR(20)  DEFAULT '335',
        settle_credit_account_code  VARCHAR(20)  DEFAULT '331',
        settle_vat_account_code     VARCHAR(20)  DEFAULT '1331',
        description                 TEXT,
        is_active                   BOOLEAN NOT NULL DEFAULT true,
        created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT uq_expense_account_rule UNIQUE (category_key, accrual_mode)
      );
    `);

    // 3. Seed các rules mặc định theo TT 200/133
    await queryRunner.query(`
      INSERT INTO erp_expense_account_rules 
      (category_key, category_label, accrual_mode, direct_debit_account_code, direct_credit_account_code, accrual_debit_account_code, accrual_credit_account_code, settle_debit_account_code, settle_credit_account_code, settle_vat_account_code, description)
      VALUES
      ('NHAN_SU_LUONG', 'Lương nhân sự (Tổng gộp)', 'ACCRUED', '6422', '1121', '6422', '334', '334', '1121', NULL, 'Chi lương tổng gộp theo tháng'),
      ('BHXH_BHYT',     'Bảo hiểm xã hội & Y tế (Tổng gộp)', 'ACCRUED', '6422', '1121', '6422', '3383', '3383', '1121', NULL, 'Trích BHXH DN chịu và chi nộp cơ quan bảo hiểm'),
      ('THUE_MAT_BANG', 'Thuê văn phòng / Mặt bằng', 'ACCRUED', '6427', '1121', '6427', '335', '335', '331', '1331', 'Trích trước tiền thuê nhà và tất toán khi HĐ về'),
      ('DIEN_NUOC_NET', 'Điện, nước, internet', 'NONE', '6427', '1121', '6427', '335', '335', '331', '1331', 'Chi phí tiện ích văn phòng'),
      ('PHAN_MEM_IT',   'Phần mềm, IT & Server', 'NONE', '6427', '1121', '6427', '335', '335', '331', '1331', 'Chi phí công nghệ và hosting'),
      ('BAO_TRI',       'Sửa chữa, bảo trì', 'NONE', '6427', '1121', '6427', '335', '335', '331', '1331', 'Bảo dưỡng tài sản và cơ sở vật chất'),
      ('KHAU_HAO',      'Khấu hao TSCĐ', 'NONE', '6424', '214', '6424', '214', '214', '214', NULL, 'Trích khấu hao tài sản cố định')
      ON CONFLICT (category_key, accrual_mode) DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS erp_expense_account_rules;`);
    await queryRunner.query(`
      ALTER TABLE erp_operating_expenses
        DROP COLUMN IF EXISTS settled_at,
        DROP COLUMN IF EXISTS linked_invoice_id,
        DROP COLUMN IF EXISTS accrual_mode,
        DROP COLUMN IF EXISTS journal_entry_id,
        DROP COLUMN IF EXISTS posting_status;
    `);
  }
}
