import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateErpCoreAccountingTables20260617055500 implements MigrationInterface {
  name = 'CreateErpCoreAccountingTables20260617055500';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. erp_chart_of_accounts
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS erp_chart_of_accounts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        account_code varchar(64) NOT NULL UNIQUE,
        account_name varchar(255) NOT NULL,
        account_type varchar(32) NOT NULL,
        normal_balance varchar(16) NOT NULL,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    // 2. erp_accounting_periods
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS erp_accounting_periods (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name varchar(255) NOT NULL,
        start_date date NOT NULL,
        end_date date NOT NULL,
        status varchar(32) NOT NULL DEFAULT 'OPEN',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    // 3. erp_module_accounting_configs
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS erp_module_accounting_configs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        module_name varchar(64) NOT NULL,
        action varchar(64) NOT NULL,
        debit_account_id uuid NULL,
        credit_account_id uuid NULL,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_module_config_debit FOREIGN KEY (debit_account_id) REFERENCES erp_chart_of_accounts(id),
        CONSTRAINT fk_module_config_credit FOREIGN KEY (credit_account_id) REFERENCES erp_chart_of_accounts(id),
        UNIQUE (module_name, action)
      )
    `);

    // 4. erp_journal_entries
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS erp_journal_entries (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        voucher_no varchar(64) NOT NULL UNIQUE,
        date date NOT NULL,
        period_id uuid NULL,
        status varchar(32) NOT NULL DEFAULT 'POSTED',
        reference_type varchar(64) NULL,
        reference_id varchar(128) NULL,
        total_debit numeric(18,2) NOT NULL DEFAULT 0,
        total_credit numeric(18,2) NOT NULL DEFAULT 0,
        description text NULL,
        created_by uuid NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_journal_entry_period FOREIGN KEY (period_id) REFERENCES erp_accounting_periods(id)
      )
    `);

    // 5. erp_journal_entry_lines
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS erp_journal_entry_lines (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        journal_entry_id uuid NOT NULL,
        account_id uuid NOT NULL,
        debit numeric(18,2) NOT NULL DEFAULT 0,
        credit numeric(18,2) NOT NULL DEFAULT 0,
        description text NULL,
        sort integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_journal_line_entry FOREIGN KEY (journal_entry_id) REFERENCES erp_journal_entries(id) ON DELETE CASCADE,
        CONSTRAINT fk_journal_line_account FOREIGN KEY (account_id) REFERENCES erp_chart_of_accounts(id)
      )
    `);

    // 6. erp_journal_entry_attachments
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS erp_journal_entry_attachments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        journal_entry_id uuid NOT NULL,
        file_name varchar(255) NOT NULL,
        r2_file_key varchar(255) NOT NULL,
        content_type varchar(128) NULL,
        file_size integer NOT NULL DEFAULT 0,
        uploaded_by uuid NULL,
        uploaded_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_journal_attachment_entry FOREIGN KEY (journal_entry_id) REFERENCES erp_journal_entries(id) ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS erp_journal_entry_attachments`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS erp_journal_entry_lines`);
    await queryRunner.query(`DROP TABLE IF EXISTS erp_journal_entries`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS erp_module_accounting_configs`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS erp_accounting_periods`);
    await queryRunner.query(`DROP TABLE IF EXISTS erp_chart_of_accounts`);
  }
}
