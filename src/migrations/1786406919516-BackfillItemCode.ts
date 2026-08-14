import { MigrationInterface, QueryRunner } from 'typeorm';

export class BackfillItemCode1786406919516 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            UPDATE erp_invoice_items
            SET item_code = (REGEXP_MATCH(description, '^([A-Z]{3}[0-9]{8}[A-Z0-9]{0,2})'))[1]
            WHERE (description ~ '^[A-Z]{3}[0-9]{8}[A-Z0-9]{0,2}[\\s\\-]'
                OR description ~ '^[A-Z]{3}[0-9]{8}[A-Z0-9]{0,2}$');
        `);

    await queryRunner.query(`
            UPDATE erp_invoice_items
            SET item_code = (REGEXP_MATCH(description, '(^|[^A-Z0-9])([A-Z]{3}[0-9]{8}[A-Z0-9]{0,2})([^A-Z0-9]|$)'))[2]
            WHERE item_code IS NULL 
              AND description ~* '[A-Z]{3}[0-9]{8}[A-Z0-9]{0,2}';
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            UPDATE erp_invoice_items
            SET item_code = NULL;
        `);
  }
}
