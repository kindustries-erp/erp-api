import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

export class MakeKgaraGrossProfitCaseIdUnique1780000000001 implements MigrationInterface {
  name = 'MakeKgaraGrossProfitCaseIdUnique1780000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the old non-unique index
    await queryRunner.dropIndex(
      'kgara_gross_profit',
      'IDX_kgara_gross_profit_hd_phieu',
    );

    // Create a new unique constraint (this also creates a unique index)
    await queryRunner.query(
      `ALTER TABLE "kgara_gross_profit" ADD CONSTRAINT "UQ_kgara_gross_profit_hd_phieu" UNIQUE ("hd_phieu_dich_vu_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the unique constraint
    await queryRunner.query(
      `ALTER TABLE "kgara_gross_profit" DROP CONSTRAINT "UQ_kgara_gross_profit_hd_phieu"`,
    );

    // Recreate the old non-unique index
    await queryRunner.createIndex(
      'kgara_gross_profit',
      new TableIndex({
        name: 'IDX_kgara_gross_profit_hd_phieu',
        columnNames: ['hd_phieu_dich_vu_id'],
      }),
    );
  }
}
