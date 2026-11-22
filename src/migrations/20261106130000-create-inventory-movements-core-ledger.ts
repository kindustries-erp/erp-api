import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lõi inventory-movements-core: sổ số dư tồn, sổ giao dịch và lớp giá FIFO. Chỉ thêm bảng mới, không đụng bảng cũ.
 * `ledger_scope` tách tồn theo domain (ví dụ GARAGE). Hai unique index partial tách dòng chi nhánh null.
 */
export class CreateInventoryMovementsCoreLedger20261106130000 implements MigrationInterface {
  name = 'CreateInventoryMovementsCoreLedger20261106130000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "stock_balances" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "ledger_scope" varchar(32) NOT NULL,
        "branch_id" uuid NULL,
        "item_code" varchar(128) NOT NULL,
        "item_name" varchar(255) NOT NULL,
        "unit" varchar(50) NOT NULL DEFAULT 'Cái',
        "qty_on_hand" numeric(18,3) NOT NULL DEFAULT 0,
        "inventory_value" numeric(18,2) NOT NULL DEFAULT 0,
        "avg_cost" numeric(18,2) NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "ux_stock_balances_scope_branch_item"
        ON "stock_balances" ("ledger_scope", "branch_id", "item_code") WHERE "branch_id" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "ux_stock_balances_scope_nobranch_item"
        ON "stock_balances" ("ledger_scope", "item_code") WHERE "branch_id" IS NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "stock_transactions" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "ledger_scope" varchar(32) NOT NULL,
        "branch_id" uuid NULL,
        "item_code" varchar(128) NOT NULL,
        "transaction_type" varchar(40) NOT NULL,
        "document_type" varchar(64) NOT NULL,
        "document_id" uuid NOT NULL,
        "qty_in" numeric(18,3) NOT NULL DEFAULT 0,
        "qty_out" numeric(18,3) NOT NULL DEFAULT 0,
        "unit_cost" numeric(18,2) NOT NULL DEFAULT 0,
        "transaction_date" timestamptz NOT NULL,
        "created_by" uuid NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "ix_stock_transactions_document"
        ON "stock_transactions" ("document_type", "document_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "ix_stock_transactions_item"
        ON "stock_transactions" ("ledger_scope", "branch_id", "item_code", "transaction_date")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "stock_cost_layers" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "ledger_scope" varchar(32) NOT NULL,
        "branch_id" uuid NULL,
        "item_code" varchar(128) NOT NULL,
        "qty_remaining" numeric(18,3) NOT NULL,
        "unit_cost" numeric(18,2) NOT NULL,
        "received_at" timestamptz NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "ix_stock_cost_layers_fifo"
        ON "stock_cost_layers" ("ledger_scope", "branch_id", "item_code", "received_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "stock_cost_layers"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "stock_transactions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "stock_balances"`);
  }
}
