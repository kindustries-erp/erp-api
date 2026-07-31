import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableIndex,
} from 'typeorm';

export class AddSoftDeleteToKgaraCases20260731104000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('kgara_cases', [
      new TableColumn({
        name: 'erp_notes',
        type: 'varchar',
        isNullable: true,
      }),
      new TableColumn({
        name: 'kgara_deleted_at',
        type: 'timestamptz',
        isNullable: true,
      }),
      new TableColumn({
        name: 'kgara_delete_count',
        type: 'integer',
        default: 0,
        isNullable: false,
      }),
    ]);

    await queryRunner.createIndices('kgara_cases', [
      new TableIndex({
        name: 'idx_kgara_cases_deleted_at',
        columnNames: ['kgara_deleted_at'],
      }),
      new TableIndex({
        name: 'idx_kgara_cases_delete_count',
        columnNames: ['kgara_delete_count'],
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('kgara_cases', 'idx_kgara_cases_delete_count');
    await queryRunner.dropIndex('kgara_cases', 'idx_kgara_cases_deleted_at');
    await queryRunner.dropColumn('kgara_cases', 'kgara_delete_count');
    await queryRunner.dropColumn('kgara_cases', 'kgara_deleted_at');
    await queryRunner.dropColumn('kgara_cases', 'erp_notes');
  }
}
