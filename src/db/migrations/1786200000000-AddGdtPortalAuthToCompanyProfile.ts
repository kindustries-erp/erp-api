import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGdtPortalAuthToCompanyProfile1786200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "company_profile" ADD COLUMN IF NOT EXISTS "gdt_portal_username" varchar(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "company_profile" ADD COLUMN IF NOT EXISTS "gdt_portal_password" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "company_profile" DROP COLUMN IF EXISTS "gdt_portal_password"`,
    );
    await queryRunner.query(
      `ALTER TABLE "company_profile" DROP COLUMN IF EXISTS "gdt_portal_username"`,
    );
  }
}
