import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCorrespondentAccountToTxn1782819577341 implements MigrationInterface {
  name = 'AddCorrespondentAccountToTxn1782819577341';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_bank_transactions" ADD "correspondent_accounting_account_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_bank_transactions" DROP COLUMN "correspondent_bank"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_bank_transactions" ADD "correspondent_bank" character varying(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_bank_transactions" ADD CONSTRAINT "FK_576b26ffe54a829ff803890f6da" FOREIGN KEY ("correspondent_accounting_account_id") REFERENCES "erp_chart_of_accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_bank_transactions" DROP CONSTRAINT "FK_576b26ffe54a829ff803890f6da"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_bank_transactions" DROP COLUMN "correspondent_bank"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_bank_transactions" ADD "correspondent_bank" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_bank_transactions" DROP COLUMN "correspondent_accounting_account_id"`,
    );
  }
}
