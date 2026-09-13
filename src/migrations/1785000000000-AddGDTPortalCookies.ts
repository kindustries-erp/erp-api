import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGDTPortalCookies1785000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "company_profile"
        ADD COLUMN IF NOT EXISTS "gdt_portal_cookies" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "company_profile"
        DROP COLUMN IF EXISTS "gdt_portal_cookies"
    `);
  }
}
