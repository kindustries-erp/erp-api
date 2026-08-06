import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableIndex,
} from 'typeorm';

export class AddSoftDeleteToKgaraCases20260731104000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasErpNotes = await queryRunner.hasColumn('kgara_cases', 'erp_notes');
    const hasDeletedAt = await queryRunner.hasColumn(
      'kgara_cases',
      'kgara_deleted_at',
    );
    const hasDeleteCount = await queryRunner.hasColumn(
      'kgara_cases',
      'kgara_delete_count',
    );

    const columnsToAdd: TableColumn[] = [];
    if (!hasErpNotes) {
      columnsToAdd.push(
        new TableColumn({
          name: 'erp_notes',
          type: 'varchar',
          isNullable: true,
        }),
      );
    }
    if (!hasDeletedAt) {
      columnsToAdd.push(
        new TableColumn({
          name: 'kgara_deleted_at',
          type: 'timestamptz',
          isNullable: true,
        }),
      );
    }
    if (!hasDeleteCount) {
      columnsToAdd.push(
        new TableColumn({
          name: 'kgara_delete_count',
          type: 'integer',
          default: 0,
          isNullable: false,
        }),
      );
    }

    if (columnsToAdd.length > 0) {
      await queryRunner.addColumns('kgara_cases', columnsToAdd);
    }

    if (!hasDeletedAt) {
      await queryRunner.createIndices('kgara_cases', [
        new TableIndex({
          name: 'idx_kgara_cases_deleted_at',
          columnNames: ['kgara_deleted_at'],
        }),
      ]);
    }

    if (!hasDeleteCount) {
      await queryRunner.createIndices('kgara_cases', [
        new TableIndex({
          name: 'idx_kgara_cases_delete_count',
          columnNames: ['kgara_delete_count'],
        }),
      ]);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_kgara_cases_delete_count"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_kgara_cases_deleted_at"`,
    );
    await queryRunner.query(`
      ALTER TABLE "kgara_cases"
        DROP COLUMN IF EXISTS "kgara_delete_count",
        DROP COLUMN IF EXISTS "kgara_deleted_at",
        DROP COLUMN IF EXISTS "erp_notes"
    `);
  }
}
