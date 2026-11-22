import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Đổi sổ tồn từ bảng dùng chung `stock_*` sang bảng riêng của Garage `garage_stock_*`.
 * Chỉ xóa các bảng `stock_*` khi đang rỗng; nếu có dữ liệu thì dừng để không mất số liệu.
 * down() tạo lại `stock_*` với cùng cấu trúc (rỗng).
 */
export class RenameStockLedgerToGarage20261106140000 implements MigrationInterface {
  name = 'RenameStockLedgerToGarage20261106140000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of [
      'stock_balances',
      'stock_transactions',
      'stock_cost_layers',
    ]) {
      const [{ count }] = await queryRunner.query(
        `SELECT count(*)::int AS count FROM "${table}"`,
      );
      if (count > 0) {
        throw new Error(`Không thể đổi tên: "${table}" còn ${count} dòng`);
      }
    }
    await queryRunner.query(`DROP TABLE "stock_cost_layers"`);
    await queryRunner.query(`DROP TABLE "stock_transactions"`);
    await queryRunner.query(`DROP TABLE "stock_balances"`);
    await createLedgerTables(queryRunner, 'garage_stock');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "garage_stock_cost_layers"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "garage_stock_transactions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "garage_stock_balances"`);
    await createLedgerTables(queryRunner, 'stock');
  }
}

/** Tạo bộ ba bảng sổ tồn với tiền tố cho trước: `<prefix>_balances`, `<prefix>_transactions`, `<prefix>_cost_layers`. */
async function createLedgerTables(
  queryRunner: QueryRunner,
  prefix: string,
): Promise<void> {
  const balances = `${prefix}_balances`;
  const transactions = `${prefix}_transactions`;
  const layers = `${prefix}_cost_layers`;

  await queryRunner.query(`
    CREATE TABLE "${balances}" (
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
    CREATE UNIQUE INDEX "ux_${balances}_scope_branch_item"
      ON "${balances}" ("ledger_scope", "branch_id", "item_code") WHERE "branch_id" IS NOT NULL
  `);
  await queryRunner.query(`
    CREATE UNIQUE INDEX "ux_${balances}_scope_nobranch_item"
      ON "${balances}" ("ledger_scope", "item_code") WHERE "branch_id" IS NULL
  `);

  await queryRunner.query(`
    CREATE TABLE "${transactions}" (
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
    CREATE INDEX "ix_${transactions}_document" ON "${transactions}" ("document_type", "document_id")
  `);
  await queryRunner.query(`
    CREATE INDEX "ix_${transactions}_item"
      ON "${transactions}" ("ledger_scope", "branch_id", "item_code", "transaction_date")
  `);

  await queryRunner.query(`
    CREATE TABLE "${layers}" (
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
    CREATE INDEX "ix_${layers}_fifo"
      ON "${layers}" ("ledger_scope", "branch_id", "item_code", "received_at")
  `);
}
