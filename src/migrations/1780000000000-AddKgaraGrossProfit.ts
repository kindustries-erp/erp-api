import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class AddKgaraGrossProfit1780000000000 implements MigrationInterface {
  name = 'AddKgaraGrossProfit1780000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'kgara_gross_profit',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'hd_phieu_dich_vu_id', type: 'varchar', length: '100' },
          {
            name: 'branch_external_id',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'vu_viec_code',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'vu_viec_name',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'ten_khach_hang',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'doanh_thu',
            type: 'decimal',
            precision: 18,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'chi_phi',
            type: 'decimal',
            precision: 18,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'loi_nhuan',
            type: 'decimal',
            precision: 18,
            scale: 2,
            isNullable: true,
          },
          { name: 'report_from', type: 'date', isNullable: true },
          { name: 'report_to', type: 'date', isNullable: true },
          { name: 'raw_data', type: 'jsonb', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'now()' },
          { name: 'updated_at', type: 'timestamp', default: 'now()' },
        ],
      }),
      true,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_kgara_gross_profit_hd_phieu" ON "kgara_gross_profit" ("hd_phieu_dich_vu_id")`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_kgara_gross_profit_branch" ON "kgara_gross_profit" ("branch_external_id")`,
    );

    // Alter kgara_case_linked_invoice
    await queryRunner.query(
      `ALTER TABLE "kgara_case_linked_invoice" DROP CONSTRAINT IF EXISTS "UQ_3bfafb21a329d20c5710d0ffda3"`,
    );

    // We must use query for altering caseDbId to nullable, changeColumn sometimes fails
    await queryRunner.query(
      `ALTER TABLE "kgara_case_linked_invoice" ALTER COLUMN "caseDbId" DROP NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "kgara_case_linked_invoice" ADD COLUMN IF NOT EXISTS "gross_profit_id" uuid`,
    );

    // Check if foreign key exists to avoid poisoning the transaction
    const fkeyCheck = await queryRunner.query(
      `SELECT constraint_name FROM information_schema.table_constraints WHERE table_name = 'kgara_case_linked_invoice' AND constraint_name = 'FK_31eda445f8c9f43b88997afe7fa'`,
    );
    if (fkeyCheck.length === 0) {
      await queryRunner.createForeignKey(
        'kgara_case_linked_invoice',
        new TableForeignKey({
          columnNames: ['gross_profit_id'],
          referencedColumnNames: ['id'],
          referencedTableName: 'kgara_gross_profit',
          onDelete: 'CASCADE',
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('kgara_case_linked_invoice');
    if (table) {
      const foreignKey = table.foreignKeys.find(
        (fk) => fk.columnNames.indexOf('gross_profit_id') !== -1,
      );
      if (foreignKey) {
        await queryRunner.dropForeignKey(
          'kgara_case_linked_invoice',
          foreignKey,
        );
      }
      await queryRunner.dropColumn(
        'kgara_case_linked_invoice',
        'gross_profit_id',
      );
    }

    await queryRunner.query(
      `ALTER TABLE "kgara_case_linked_invoice" ALTER COLUMN "caseDbId" SET NOT NULL`,
    );

    await queryRunner.dropTable('kgara_gross_profit');
  }
}
