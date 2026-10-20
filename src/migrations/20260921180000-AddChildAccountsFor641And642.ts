import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChildAccountsFor641And64220260921180000 implements MigrationInterface {
  name = 'AddChildAccountsFor641And64220260921180000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Đảm bảo tài khoản mẹ 641 (Chi phí bán hàng) tồn tại
    await queryRunner.query(`
      INSERT INTO erp_chart_of_accounts (account_code, account_name, account_type, parent_id, is_active, is_deleted, created_at, updated_at)
      SELECT '641', 'Chi phí bán hàng', 'EXPENSE', NULL, true, false, NOW(), NOW()
      WHERE NOT EXISTS (
        SELECT 1 FROM erp_chart_of_accounts WHERE account_code = '641' AND is_deleted = false
      );
    `);

    // 2. Các tài khoản con của 641 (Cấp 2)
    const sub641 = [
      { code: '6411', name: 'Chi phí nhân viên bán hàng' },
      { code: '6412', name: 'Chi phí vật liệu, bao bì' },
      { code: '6413', name: 'Chi phí dụng cụ, đồ dùng' },
      { code: '6414', name: 'Chi phí khấu hao TSCĐ' },
      { code: '6415', name: 'Chi phí bảo hành' },
      { code: '6417', name: 'Chi phí dịch vụ mua ngoài' },
      { code: '6418', name: 'Chi phí bằng tiền khác' },
    ];

    for (const acc of sub641) {
      await queryRunner.query(`
        INSERT INTO erp_chart_of_accounts (account_code, account_name, account_type, parent_id, is_active, is_deleted, created_at, updated_at)
        SELECT '${acc.code}', '${acc.name}', 'EXPENSE', (SELECT id FROM erp_chart_of_accounts WHERE account_code = '641' AND is_deleted = false LIMIT 1), true, false, NOW(), NOW()
        WHERE NOT EXISTS (
          SELECT 1 FROM erp_chart_of_accounts WHERE account_code = '${acc.code}' AND is_deleted = false
        );
      `);
    }

    // 3. Đảm bảo tài khoản mẹ 642 (Chi phí quản lý doanh nghiệp) tồn tại
    await queryRunner.query(`
      INSERT INTO erp_chart_of_accounts (account_code, account_name, account_type, parent_id, is_active, is_deleted, created_at, updated_at)
      SELECT '642', 'Chi phí quản lý doanh nghiệp', 'EXPENSE', NULL, true, false, NOW(), NOW()
      WHERE NOT EXISTS (
        SELECT 1 FROM erp_chart_of_accounts WHERE account_code = '642' AND is_deleted = false
      );
    `);

    // 4. Các tài khoản con của 642 (Cấp 2)
    const sub642 = [
      { code: '6421', name: 'Chi phí nhân viên quản lý' },
      { code: '6422', name: 'Chi phí vật liệu quản lý' },
      { code: '6423', name: 'Chi phí đồ dùng văn phòng' },
      { code: '6424', name: 'Chi phí khấu hao TSCĐ' },
      { code: '6425', name: 'Thuế, phí và lệ phí' },
      { code: '6426', name: 'Chi phí dự phòng' },
      { code: '6427', name: 'Chi phí dịch vụ mua ngoài' },
      { code: '6428', name: 'Chi phí bằng tiền khác' },
    ];

    for (const acc of sub642) {
      await queryRunner.query(`
        INSERT INTO erp_chart_of_accounts (account_code, account_name, account_type, parent_id, is_active, is_deleted, created_at, updated_at)
        SELECT '${acc.code}', '${acc.name}', 'EXPENSE', (SELECT id FROM erp_chart_of_accounts WHERE account_code = '642' AND is_deleted = false LIMIT 1), true, false, NOW(), NOW()
        WHERE NOT EXISTS (
          SELECT 1 FROM erp_chart_of_accounts WHERE account_code = '${acc.code}' AND is_deleted = false
        );
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM erp_chart_of_accounts
      WHERE account_code IN (
        '6411', '6412', '6413', '6414', '6415', '6417', '6418',
        '6421', '6422', '6423', '6424', '6425', '6426', '6427', '6428'
      );
    `);
  }
}
