import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddGDTPortalCookies1785000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'company_profile',
      new TableColumn({
        name: 'gdt_portal_cookies',
        type: 'text',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('company_profile', 'gdt_portal_cookies');
  }
}
