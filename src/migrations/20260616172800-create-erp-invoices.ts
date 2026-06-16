import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateErpInvoices20260616172800 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS erp_invoices (
        id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_no        VARCHAR(128)  NOT NULL,
        serial_no         VARCHAR(64)   NULL,
        invoice_date      DATE          NOT NULL,
        direction         VARCHAR(16)   NOT NULL DEFAULT 'IN',
        status            VARCHAR(32)   NOT NULL DEFAULT 'DRAFT',

        seller_name       VARCHAR(255)  NULL,
        seller_tax_code   VARCHAR(64)   NULL,
        seller_address    TEXT          NULL,
        seller_bank       VARCHAR(255)  NULL,

        buyer_name        VARCHAR(255)  NULL,
        buyer_tax_code    VARCHAR(64)   NULL,
        buyer_address     TEXT          NULL,

        description       TEXT          NULL,
        pre_vat_amount    NUMERIC(18,2) NOT NULL DEFAULT 0,
        vat_rate          NUMERIC(9,4)  NULL,
        vat_amount        NUMERIC(18,2) NOT NULL DEFAULT 0,
        discount_amount   NUMERIC(18,2) NOT NULL DEFAULT 0,
        total_amount      NUMERIC(18,2) NOT NULL DEFAULT 0,

        purchase_order_id UUID          NULL,
        sales_order_id    UUID          NULL,

        notes             TEXT          NULL,
        created_by        UUID          NULL,
        created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
        updated_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
      )
    `);

    // FK → erp_purchase_orders (confirmed exists)
    await queryRunner.query(`
      ALTER TABLE erp_invoices
        ADD CONSTRAINT fk_erp_invoices_po
        FOREIGN KEY (purchase_order_id)
        REFERENCES erp_purchase_orders(id)
        ON DELETE SET NULL
    `);

    // FK → erp_sales_orders (confirmed exists)
    await queryRunner.query(`
      ALTER TABLE erp_invoices
        ADD CONSTRAINT fk_erp_invoices_so
        FOREIGN KEY (sales_order_id)
        REFERENCES erp_sales_orders(id)
        ON DELETE SET NULL
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_erp_invoices_direction ON erp_invoices(direction)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_erp_invoices_invoice_date ON erp_invoices(invoice_date)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_erp_invoices_po_id ON erp_invoices(purchase_order_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_erp_invoices_so_id ON erp_invoices(sales_order_id)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS erp_invoices`);
  }
}
