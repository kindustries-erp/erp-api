import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAccountKeyToKgaraTables20261102160000 implements MigrationInterface {
  name = 'AddAccountKeyToKgaraTables20261102160000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. kgara_auth
    await queryRunner.query(
      `ALTER TABLE "kgara_auth" ADD COLUMN IF NOT EXISTS "account_key" varchar(50) NOT NULL DEFAULT 'MAIN'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_kgara_auth_account_key" ON "kgara_auth" ("account_key")`,
    );

    // 2. kgara_branches
    await queryRunner.query(
      `ALTER TABLE "kgara_branches" ADD COLUMN IF NOT EXISTS "account_key" varchar(50) NOT NULL DEFAULT 'MAIN'`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_kgara_branches_account_key" ON "kgara_branches" ("account_key")`,
    );

    // 3. kgara_cases
    await queryRunner.query(
      `ALTER TABLE "kgara_cases" ADD COLUMN IF NOT EXISTS "account_key" varchar(50) NOT NULL DEFAULT 'MAIN'`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_kgara_cases_account_key" ON "kgara_cases" ("account_key")`,
    );

    // 4. kgara_sync_runs
    await queryRunner.query(
      `ALTER TABLE "kgara_sync_runs" ADD COLUMN IF NOT EXISTS "account_key" varchar(50) NOT NULL DEFAULT 'MAIN'`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_kgara_sync_runs_account_key" ON "kgara_sync_runs" ("account_key")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_kgara_sync_runs_account_key"`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_sync_runs" DROP COLUMN IF EXISTS "account_key"`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_kgara_cases_account_key"`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_cases" DROP COLUMN IF EXISTS "account_key"`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_kgara_branches_account_key"`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_branches" DROP COLUMN IF EXISTS "account_key"`,
    );

    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_kgara_auth_account_key"`);
    await queryRunner.query(
      `ALTER TABLE "kgara_auth" DROP COLUMN IF EXISTS "account_key"`,
    );
  }
}
