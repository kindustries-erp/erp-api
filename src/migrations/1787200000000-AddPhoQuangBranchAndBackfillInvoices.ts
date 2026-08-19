import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPhoQuangBranchAndBackfillInvoices1787200000000 implements MigrationInterface {
  name = 'AddPhoQuangBranchAndBackfillInvoices1787200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Insert Phổ Quang branch if not exists
    await queryRunner.query(`
      INSERT INTO erp_branches (id, code, name, is_active, created_at, updated_at)
      SELECT uuid_generate_v4(), 'PQ', 'Phổ Quang', true, NOW(), NOW()
      WHERE NOT EXISTS (
        SELECT 1 FROM erp_branches WHERE code = 'PQ'
      );
    `);

    // 2. Backfill IN invoices with MST 0202357718 to Đào Trí ('ĐT')
    await queryRunner.query(`
      UPDATE erp_invoices
      SET branch_id = (SELECT id FROM erp_branches WHERE code = 'ĐT' LIMIT 1)
      WHERE direction = 'IN'
        AND (seller_tax_code = '0202357718' OR buyer_tax_code = '0202357718')
        AND (branch_id IS NULL OR branch_id != (SELECT id FROM erp_branches WHERE code = 'ĐT' LIMIT 1));
    `);

    // 3. Backfill OUT invoices matching Đào Trí rules to 'ĐT'
    await queryRunner.query(`
      UPDATE erp_invoices
      SET branch_id = (SELECT id FROM erp_branches WHERE code = 'ĐT' LIMIT 1)
      WHERE direction = 'OUT'
        AND (
          buyer_tax_code IN ('0110269067-001', '0110269067', '0202357718', '0108926276')
          OR settlement_order ~* '^(S52801|S52802|S64701)-WO-'
        )
        AND branch_id IS NULL;
    `);

    // 4. Backfill remaining OUT invoices with NULL branch_id to Phổ Quang ('PQ')
    await queryRunner.query(`
      UPDATE erp_invoices
      SET branch_id = (SELECT id FROM erp_branches WHERE code = 'PQ' LIMIT 1)
      WHERE direction = 'OUT'
        AND branch_id IS NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert is a no-op to preserve invoice integrity
  }
}
