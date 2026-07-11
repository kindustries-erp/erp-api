import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGdtPortalToken1783661312342 implements MigrationInterface {
  name = 'AddGdtPortalToken1783661312342';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "company_profile" ADD COLUMN IF NOT EXISTS "gdt_portal_token" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "company_profile" DROP COLUMN IF EXISTS "gdt_portal_token"`,
    );
  }
}
