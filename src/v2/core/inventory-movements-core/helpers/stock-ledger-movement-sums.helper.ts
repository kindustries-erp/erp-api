import type { DataSource } from 'typeorm';
import type { StockLedgerConfig } from '../contracts/inventory-movements-core.contract';
import { toNumber } from './decimal.helper';

/**
 * Nhập, xuất, điều chỉnh cộng dồn toàn thời gian của một mã hàng trong một ledger.
 * Quy tắc (khớp erp-inventory-stock v1): Nhập = SUM(qty_in) và Xuất = SUM(qty_out) của
 * giao dịch thường; Điều chỉnh = SUM(qty_in - qty_out) của ADJUSTMENT và ADJUSTMENT_CANCEL.
 */
export interface StockMovementSums {
  qtyReceived: number;
  qtyIssued: number;
  qtyAdjusted: number;
}

interface RawSums {
  itemCode?: string;
  qtyReceived: string | null;
  qtyIssued: string | null;
  qtyAdjusted: string | null;
}

const ADJUSTMENT_TYPES = `('ADJUSTMENT', 'ADJUSTMENT_CANCEL')`;

function toSums(row: Partial<RawSums> | undefined): StockMovementSums {
  return {
    qtyReceived: toNumber(row?.qtyReceived),
    qtyIssued: toNumber(row?.qtyIssued),
    qtyAdjusted: toNumber(row?.qtyAdjusted),
  };
}

/** Dựng truy vấn gộp trên sổ giao dịch, chỉ lấy đúng phạm vi ledger và danh sách mã. */
function sumsQuery(
  dataSource: DataSource,
  config: StockLedgerConfig,
  itemCodes: string[],
) {
  return dataSource
    .getRepository(config.tables.transaction)
    .createQueryBuilder('t')
    .select(
      `SUM(CASE WHEN t.transactionType NOT IN ${ADJUSTMENT_TYPES} THEN t.qtyIn ELSE 0 END)`,
      'qtyReceived',
    )
    .addSelect(
      `SUM(CASE WHEN t.transactionType NOT IN ${ADJUSTMENT_TYPES} THEN t.qtyOut ELSE 0 END)`,
      'qtyIssued',
    )
    .addSelect(
      `SUM(CASE WHEN t.transactionType IN ${ADJUSTMENT_TYPES} THEN t.qtyIn - t.qtyOut ELSE 0 END)`,
      'qtyAdjusted',
    )
    .where('t.ledgerScope = :scope', { scope: config.ledgerScope })
    .andWhere('t.itemCode IN (:...itemCodes)', { itemCodes });
}

/** Nhập/xuất/điều chỉnh theo từng mã trong danh sách (dùng cho các dòng của một trang). */
export async function loadMovementSumsByItem(
  dataSource: DataSource,
  config: StockLedgerConfig,
  itemCodes: string[],
): Promise<Map<string, StockMovementSums>> {
  const byItem = new Map<string, StockMovementSums>();
  if (!itemCodes.length) return byItem;
  const rows = await sumsQuery(dataSource, config, itemCodes)
    .addSelect('t.itemCode', 'itemCode')
    .groupBy('t.itemCode')
    .getRawMany<RawSums>();
  for (const row of rows) {
    if (row.itemCode) byItem.set(row.itemCode, toSums(row));
  }
  return byItem;
}

/** Tổng nhập/xuất/điều chỉnh của toàn bộ danh sách mã (theo tab và tìm kiếm hiện hành). */
export async function loadMovementTotals(
  dataSource: DataSource,
  config: StockLedgerConfig,
  itemCodes: string[],
): Promise<StockMovementSums> {
  if (!itemCodes.length) return toSums(undefined);
  const [row] = await sumsQuery(
    dataSource,
    config,
    itemCodes,
  ).getRawMany<RawSums>();
  return toSums(row);
}
