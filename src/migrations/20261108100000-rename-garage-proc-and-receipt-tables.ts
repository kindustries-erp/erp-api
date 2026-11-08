import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Đổi tên 8 bảng Garage (PR/PO và nhập kho): bỏ tiền tố `erp_`, thêm hậu tố `_garage`.
 * Giữ nguyên dữ liệu (RENAME, không DROP). FK đi theo bảng nên không đổi.
 * Constraint và index chứa `erp_garage_` đổi thành `garage_` cho khớp.
 * down() đảo ngược đúng danh sách đã liệt kê.
 */

/** [tên cũ, tên mới] của bảng. */
const TABLES: ReadonlyArray<readonly [string, string]> = [
  ['erp_garage_proc_requests', 'proc_requests_garage'],
  ['erp_garage_proc_request_lines', 'proc_request_lines_garage'],
  ['erp_garage_proc_orders', 'proc_orders_garage'],
  ['erp_garage_proc_order_lines', 'proc_order_lines_garage'],
  ['erp_garage_proc_order_acceptances', 'proc_order_acceptances_garage'],
  ['erp_garage_goods_receipts', 'goods_receipts_garage'],
  ['erp_garage_goods_receipt_lines', 'goods_receipt_lines_garage'],
  ['erp_garage_inventory_balances', 'inventory_balances_garage'],
];

/** [tên bảng MỚI, tên constraint cũ] — PK/UQ/FK/CHECK. Đổi sau khi đổi tên bảng. */
const CONSTRAINTS: ReadonlyArray<readonly [string, string]> = [
  [
    'goods_receipt_lines_garage',
    'FK_erp_garage_goods_receipt_lines_receipt_id',
  ],
  ['goods_receipt_lines_garage', 'FK_erp_garage_gr_lines_proc_order_line'],
  ['goods_receipt_lines_garage', 'PK_erp_garage_goods_receipt_lines_id'],
  ['goods_receipts_garage', 'FK_erp_garage_goods_receipts_proc_order'],
  ['goods_receipts_garage', 'PK_erp_garage_goods_receipts_id'],
  ['inventory_balances_garage', 'PK_erp_garage_inventory_balances_id'],
  ['proc_order_acceptances_garage', 'CHK_erp_garage_proc_acc_qty'],
  ['proc_order_acceptances_garage', 'FK_erp_garage_proc_acc_line'],
  ['proc_order_acceptances_garage', 'FK_erp_garage_proc_acc_order'],
  ['proc_order_acceptances_garage', 'PK_erp_garage_proc_order_acceptances'],
  ['proc_order_lines_garage', 'CHK_erp_garage_proc_order_lines_fulfilled'],
  ['proc_order_lines_garage', 'CHK_erp_garage_proc_order_lines_type'],
  ['proc_order_lines_garage', 'FK_erp_garage_proc_order_lines_order'],
  ['proc_order_lines_garage', 'FK_erp_garage_proc_order_lines_request_line'],
  ['proc_order_lines_garage', 'PK_erp_garage_proc_order_lines'],
  ['proc_orders_garage', 'CHK_erp_garage_proc_orders_source'],
  ['proc_orders_garage', 'FK_erp_garage_proc_orders_request'],
  ['proc_orders_garage', 'PK_erp_garage_proc_orders'],
  ['proc_orders_garage', 'UQ_erp_garage_proc_orders_no'],
  ['proc_request_lines_garage', 'CHK_erp_garage_proc_request_lines_qty'],
  ['proc_request_lines_garage', 'CHK_erp_garage_proc_request_lines_type'],
  ['proc_request_lines_garage', 'FK_erp_garage_proc_request_lines_request'],
  ['proc_request_lines_garage', 'PK_erp_garage_proc_request_lines'],
  ['proc_requests_garage', 'PK_erp_garage_proc_requests'],
  ['proc_requests_garage', 'UQ_erp_garage_proc_requests_no'],
];

/** Index thường và unique index (không gắn constraint). */
const INDEXES: readonly string[] = [
  'IDX_erp_garage_goods_receipt_lines_item_code',
  'IDX_erp_garage_goods_receipt_lines_receipt_id',
  'IDX_erp_garage_gr_lines_proc_order_line',
  'IDX_erp_garage_goods_receipts_branch_id',
  'IDX_erp_garage_goods_receipts_is_deleted',
  'IDX_erp_garage_goods_receipts_proc_order',
  'IDX_erp_garage_goods_receipts_receipt_date',
  'IDX_erp_garage_goods_receipts_status',
  'IDX_erp_garage_goods_receipts_supplier_id',
  'UQ_erp_garage_goods_receipts_receipt_no',
  'IDX_erp_garage_inventory_balances_branch_id',
  'IDX_erp_garage_inventory_balances_item_code',
  'IDX_erp_garage_proc_acc_line',
  'IDX_erp_garage_proc_acc_order',
  'IDX_erp_garage_proc_order_lines_item',
  'IDX_erp_garage_proc_order_lines_order',
  'IDX_erp_garage_proc_order_lines_request_line',
  'IDX_erp_garage_proc_orders_approver_id',
  'IDX_erp_garage_proc_orders_branch',
  'IDX_erp_garage_proc_orders_deleted',
  'IDX_erp_garage_proc_orders_fulfillment',
  'IDX_erp_garage_proc_orders_payment_status',
  'IDX_erp_garage_proc_orders_request',
  'IDX_erp_garage_proc_orders_status',
  'IDX_erp_garage_proc_orders_supplier',
  'IDX_erp_garage_proc_request_lines_item',
  'IDX_erp_garage_proc_request_lines_request',
  'IDX_erp_garage_proc_requests_approver_id',
  'IDX_erp_garage_proc_requests_branch',
  'IDX_erp_garage_proc_requests_deleted',
  'IDX_erp_garage_proc_requests_ordering',
  'IDX_erp_garage_proc_requests_status',
];

/** Đổi `erp_garage_` thành `garage_` cho tên constraint/index. */
const toNew = (name: string): string => name.replace('erp_garage_', 'garage_');

export class RenameGarageProcAndReceiptTables20261108100000 implements MigrationInterface {
  name = 'RenameGarageProcAndReceiptTables20261108100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [oldName, newName] of TABLES) {
      await queryRunner.query(
        `ALTER TABLE "${oldName}" RENAME TO "${newName}"`,
      );
    }
    for (const [table, constraint] of CONSTRAINTS) {
      await queryRunner.query(
        `ALTER TABLE "${table}" RENAME CONSTRAINT "${constraint}" TO "${toNew(constraint)}"`,
      );
    }
    for (const index of INDEXES) {
      await queryRunner.query(
        `ALTER INDEX "${index}" RENAME TO "${toNew(index)}"`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const index of INDEXES) {
      await queryRunner.query(
        `ALTER INDEX "${toNew(index)}" RENAME TO "${index}"`,
      );
    }
    for (const [table, constraint] of CONSTRAINTS) {
      await queryRunner.query(
        `ALTER TABLE "${table}" RENAME CONSTRAINT "${toNew(constraint)}" TO "${constraint}"`,
      );
    }
    for (const [oldName, newName] of TABLES) {
      await queryRunner.query(
        `ALTER TABLE "${newName}" RENAME TO "${oldName}"`,
      );
    }
  }
}
