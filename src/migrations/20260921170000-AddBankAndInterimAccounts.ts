import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBankAndInterimAccounts20260921170000 implements MigrationInterface {
  name = 'AddBankAndInterimAccounts20260921170000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Nhóm tài khoản trung gian chờ xử lý (TK 000 cấp 1)
    await queryRunner.query(`
      INSERT INTO erp_chart_of_accounts (account_code, account_name, account_type, parent_id, is_active, is_deleted, created_at, updated_at)
      SELECT '000', 'Tài khoản trung gian chờ xử lý', 'OTHER', NULL, true, false, NOW(), NOW()
      WHERE NOT EXISTS (
        SELECT 1 FROM erp_chart_of_accounts WHERE account_code = '000' AND is_deleted = false
      );
    `);

    // 2. Các tài khoản con chờ xử lý (0001, 0002, 0003 con của 000)
    await queryRunner.query(`
      INSERT INTO erp_chart_of_accounts (account_code, account_name, account_type, parent_id, is_active, is_deleted, created_at, updated_at)
      SELECT '0001', 'Bút toán chờ xử lý - Ngân hàng', 'OTHER', (SELECT id FROM erp_chart_of_accounts WHERE account_code = '000' AND is_deleted = false LIMIT 1), true, false, NOW(), NOW()
      WHERE NOT EXISTS (
        SELECT 1 FROM erp_chart_of_accounts WHERE account_code = '0001' AND is_deleted = false
      );
    `);

    await queryRunner.query(`
      INSERT INTO erp_chart_of_accounts (account_code, account_name, account_type, parent_id, is_active, is_deleted, created_at, updated_at)
      SELECT '0002', 'Bút toán chờ xử lý - Hóa đơn', 'OTHER', (SELECT id FROM erp_chart_of_accounts WHERE account_code = '000' AND is_deleted = false LIMIT 1), true, false, NOW(), NOW()
      WHERE NOT EXISTS (
        SELECT 1 FROM erp_chart_of_accounts WHERE account_code = '0002' AND is_deleted = false
      );
    `);

    await queryRunner.query(`
      INSERT INTO erp_chart_of_accounts (account_code, account_name, account_type, parent_id, is_active, is_deleted, created_at, updated_at)
      SELECT '0003', 'Bút toán chờ xử lý - Khác', 'OTHER', (SELECT id FROM erp_chart_of_accounts WHERE account_code = '000' AND is_deleted = false LIMIT 1), true, false, NOW(), NOW()
      WHERE NOT EXISTS (
        SELECT 1 FROM erp_chart_of_accounts WHERE account_code = '0003' AND is_deleted = false
      );
    `);

    // 3. Nhóm tài khoản tiền gửi ngân hàng chi tiết (11211, 11212, 11213 con của 1121)
    await queryRunner.query(`
      INSERT INTO erp_chart_of_accounts (account_code, account_name, account_type, parent_id, is_active, is_deleted, created_at, updated_at)
      SELECT '11211', 'Techcombank - 111886', 'ASSET', (SELECT id FROM erp_chart_of_accounts WHERE account_code = '1121' AND is_deleted = false LIMIT 1), true, false, NOW(), NOW()
      WHERE NOT EXISTS (
        SELECT 1 FROM erp_chart_of_accounts WHERE account_code = '11211' AND is_deleted = false
      );
    `);

    await queryRunner.query(`
      INSERT INTO erp_chart_of_accounts (account_code, account_name, account_type, parent_id, is_active, is_deleted, created_at, updated_at)
      SELECT '11212', 'Techcombank - 886111', 'ASSET', (SELECT id FROM erp_chart_of_accounts WHERE account_code = '1121' AND is_deleted = false LIMIT 1), true, false, NOW(), NOW()
      WHERE NOT EXISTS (
        SELECT 1 FROM erp_chart_of_accounts WHERE account_code = '11212' AND is_deleted = false
      );
    `);

    await queryRunner.query(`
      INSERT INTO erp_chart_of_accounts (account_code, account_name, account_type, parent_id, is_active, is_deleted, created_at, updated_at)
      SELECT '11213', 'BIDV - 8680073168', 'ASSET', (SELECT id FROM erp_chart_of_accounts WHERE account_code = '1121' AND is_deleted = false LIMIT 1), true, false, NOW(), NOW()
      WHERE NOT EXISTS (
        SELECT 1 FROM erp_chart_of_accounts WHERE account_code = '11213' AND is_deleted = false
      );
    `);

    // 4. Cập nhật liên kết accounting_account_id trong bảng erp_bank_accounts
    await queryRunner.query(`
      UPDATE erp_bank_accounts
      SET accounting_account_id = (SELECT id FROM erp_chart_of_accounts WHERE account_code = '11211' AND is_deleted = false LIMIT 1),
          updated_at = NOW()
      WHERE account_number = '111886' AND is_deleted = false;
    `);

    await queryRunner.query(`
      UPDATE erp_bank_accounts
      SET accounting_account_id = (SELECT id FROM erp_chart_of_accounts WHERE account_code = '11212' AND is_deleted = false LIMIT 1),
          updated_at = NOW()
      WHERE account_number = '886111' AND is_deleted = false;
    `);

    await queryRunner.query(`
      UPDATE erp_bank_accounts
      SET accounting_account_id = (SELECT id FROM erp_chart_of_accounts WHERE account_code = '11213' AND is_deleted = false LIMIT 1),
          updated_at = NOW()
      WHERE account_number = '8680073168' AND is_deleted = false;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Reset accounting_account_id trên erp_bank_accounts
    await queryRunner.query(`
      UPDATE erp_bank_accounts
      SET accounting_account_id = (SELECT id FROM erp_chart_of_accounts WHERE account_code = '1121' AND is_deleted = false LIMIT 1),
          updated_at = NOW()
      WHERE account_number IN ('111886', '886111', '8680073168') AND is_deleted = false;
    `);

    // 2. Xóa các tài khoản con
    await queryRunner.query(`
      DELETE FROM erp_chart_of_accounts WHERE account_code IN ('11211', '11212', '11213', '0001', '0002', '0003');
    `);

    // 3. Xóa tài khoản mẹ 000
    await queryRunner.query(`
      DELETE FROM erp_chart_of_accounts WHERE account_code = '000';
    `);
  }
}
