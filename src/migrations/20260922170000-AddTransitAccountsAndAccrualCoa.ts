import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTransitAccountsAndAccrualCoa20260922170000 implements MigrationInterface {
  name = 'AddTransitAccountsAndAccrualCoa20260922170000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Thêm TK 335 (Chi phí phải trả / Trích trước)
    await queryRunner.query(`
      INSERT INTO erp_chart_of_accounts (id, account_code, account_name, account_type, is_active, is_deleted, created_at, updated_at)
      SELECT gen_random_uuid(), '335', 'Chi phí phải trả (Trích trước)', 'LIABILITY', true, false, NOW(), NOW()
      WHERE NOT EXISTS (
        SELECT 1 FROM erp_chart_of_accounts WHERE account_code = '335' AND is_deleted = false
      );
    `);

    // 2. Thêm nhóm tài khoản treo T000
    await queryRunner.query(`
      INSERT INTO erp_chart_of_accounts (id, account_code, account_name, account_type, is_active, is_deleted, created_at, updated_at)
      SELECT gen_random_uuid(), 'T000', 'Tài khoản treo chờ xử lý (Transit Accounts)', 'OTHER', true, false, NOW(), NOW()
      WHERE NOT EXISTS (
        SELECT 1 FROM erp_chart_of_accounts WHERE account_code = 'T000' AND is_deleted = false
      );
    `);

    const parentRes = await queryRunner.query(`
      SELECT id FROM erp_chart_of_accounts WHERE account_code = 'T000' AND is_deleted = false LIMIT 1
    `);
    const parentId = parentRes.length > 0 ? `'${parentRes[0].id}'` : 'NULL';

    // 3. Thêm T0001 (Sao kê), T0002 (HĐ Bán), T0003 (HĐ Mua), T0004 (Khác)
    await queryRunner.query(`
      INSERT INTO erp_chart_of_accounts (id, account_code, account_name, account_type, parent_id, is_active, is_deleted, created_at, updated_at)
      SELECT gen_random_uuid(), 'T0001', 'Chờ xử lý - Sao kê ngân hàng', 'OTHER', ${parentId}, true, false, NOW(), NOW()
      WHERE NOT EXISTS (
        SELECT 1 FROM erp_chart_of_accounts WHERE account_code = 'T0001' AND is_deleted = false
      );
    `);

    await queryRunner.query(`
      INSERT INTO erp_chart_of_accounts (id, account_code, account_name, account_type, parent_id, is_active, is_deleted, created_at, updated_at)
      SELECT gen_random_uuid(), 'T0002', 'Chờ xử lý - Hóa đơn bán hàng (OUT)', 'OTHER', ${parentId}, true, false, NOW(), NOW()
      WHERE NOT EXISTS (
        SELECT 1 FROM erp_chart_of_accounts WHERE account_code = 'T0002' AND is_deleted = false
      );
    `);

    await queryRunner.query(`
      INSERT INTO erp_chart_of_accounts (id, account_code, account_name, account_type, parent_id, is_active, is_deleted, created_at, updated_at)
      SELECT gen_random_uuid(), 'T0003', 'Chờ xử lý - Hóa đơn mua hàng (IN)', 'OTHER', ${parentId}, true, false, NOW(), NOW()
      WHERE NOT EXISTS (
        SELECT 1 FROM erp_chart_of_accounts WHERE account_code = 'T0003' AND is_deleted = false
      );
    `);

    await queryRunner.query(`
      INSERT INTO erp_chart_of_accounts (id, account_code, account_name, account_type, parent_id, is_active, is_deleted, created_at, updated_at)
      SELECT gen_random_uuid(), 'T0004', 'Chờ xử lý - Nghiệp vụ khác', 'OTHER', ${parentId}, true, false, NOW(), NOW()
      WHERE NOT EXISTS (
        SELECT 1 FROM erp_chart_of_accounts WHERE account_code = 'T0004' AND is_deleted = false
      );
    `);

    // 4. Cập nhật diễn giải của nhóm 0001 - 0004 nếu có
    await queryRunner.query(`
      UPDATE erp_chart_of_accounts
      SET account_name = 'Bút toán chờ xử lý - Hóa đơn bán ra (OUT)', updated_at = NOW()
      WHERE account_code = '0002' AND is_deleted = false;
    `);

    await queryRunner.query(`
      INSERT INTO erp_chart_of_accounts (id, account_code, account_name, account_type, is_active, is_deleted, created_at, updated_at)
      SELECT gen_random_uuid(), '0004', 'Bút toán chờ xử lý - Khác', 'OTHER', true, false, NOW(), NOW()
      WHERE NOT EXISTS (
        SELECT 1 FROM erp_chart_of_accounts WHERE account_code = '0004' AND is_deleted = false
      );
    `);

    await queryRunner.query(`
      UPDATE erp_chart_of_accounts
      SET account_name = 'Bút toán chờ xử lý - Hóa đơn mua vào (IN)', updated_at = NOW()
      WHERE account_code = '0003' AND is_deleted = false;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM erp_chart_of_accounts 
      WHERE account_code IN ('T0001', 'T0002', 'T0003', 'T0004', 'T000', '335');
    `);
  }
}
