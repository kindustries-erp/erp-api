import { MigrationInterface, QueryRunner, Table, TableUnique } from 'typeorm';

export class AddKgaraCaseLinkedInvoice20260727170000 implements MigrationInterface {
  name = 'AddKgaraCaseLinkedInvoice20260727170000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'kgara_case_linked_invoice',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'caseDbId',
            type: 'uuid',
          },
          {
            name: 'invoiceId',
            type: 'uuid',
          },
          {
            name: 'linkType',
            type: 'varchar',
            length: '10',
            default: "'IN'",
          },
          {
            name: 'note',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    await queryRunner.createUniqueConstraint(
      'kgara_case_linked_invoice',
      new TableUnique({
        name: 'UQ_kgara_case_linked_invoice',
        columnNames: ['caseDbId', 'invoiceId'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('kgara_case_linked_invoice');
  }
}
