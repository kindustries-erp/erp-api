import {
  calculateLedgerHistoryCogs,
  LedgerEntryForFifo,
} from '../../vinfast-parts/engines/vinfast-fifo.engine';

/** Dòng sổ cái hợp lệ (đã lọc trạng thái, đã sắp theo VINFAST_LEDGER_ORDER_SQL) từ truy vấn dashboard. */
export interface VinfastLedgerPeriodRow {
  part_sku: string;
  id: string;
  direction: string;
  qty: string | number;
  unit_cost: string | number | null;
  pre_vat_amount: string | number | null;
  transaction_date: string | Date;
  is_adjustment: boolean;
  adj_sign: number;
  item_name?: string | null;
}

export interface VinfastFifoPeriodMetric {
  month: string;
  itemCode: string;
  itemName: string;
  qtyBought: number;
  qtySold: number;
  amountBought: number;
  amountSold: number;
  totalCogs: number;
}

/**
 * Khóa kỳ theo khoảng thời gian. Tuần bắt đầu thứ Hai; năm = ngày 01/01.
 */
export function buildPeriodKey(date: Date, groupInterval: string): string {
  const year = date.getFullYear();
  const mStr = String(date.getMonth() + 1).padStart(2, '0');

  if (groupInterval === 'day') {
    return `${year}-${mStr}-${String(date.getDate()).padStart(2, '0')}`;
  }
  if (groupInterval === 'week') {
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date.getTime());
    monday.setDate(diff);
    const mYear = monday.getFullYear();
    const mMonth = String(monday.getMonth() + 1).padStart(2, '0');
    const mDay = String(monday.getDate()).padStart(2, '0');
    return `${mYear}-${mMonth}-${mDay}`;
  }
  if (groupInterval === 'year') {
    return `${year}-01-01`;
  }
  return `${year}-${mStr}`;
}

/**
 * Gom số liệu FIFO theo (SKU, kỳ). Giá vốn và tồn lấy từ lõi engine FIFO,
 * nên hàng trả (điều chỉnh âm) hoàn kho đúng giá vốn và COGS của dòng trả là âm.
 */
export function buildVinfastFifoPeriodMetrics(
  rows: VinfastLedgerPeriodRow[],
  groupInterval: string = 'month',
): VinfastFifoPeriodMetric[] {
  const entriesBySku = new Map<string, LedgerEntryForFifo[]>();
  const entryByRow: LedgerEntryForFifo[] = rows.map((r) => {
    const entry: LedgerEntryForFifo = {
      id: r.id,
      direction: r.direction,
      qty: Number(r.qty || 0),
      unitCost: Number(r.unit_cost || 0),
      preVatAmount: Number(r.pre_vat_amount || 0),
      transactionDate: String(r.transaction_date),
      isAdjustment: !!r.is_adjustment,
      adjSign: Number(r.adj_sign ?? 1),
    };
    if (!entriesBySku.has(r.part_sku)) entriesBySku.set(r.part_sku, []);
    entriesBySku.get(r.part_sku)!.push(entry);
    return entry;
  });

  entriesBySku.forEach((entries) => calculateLedgerHistoryCogs(entries));

  const metricsByKey: Record<string, VinfastFifoPeriodMetric> = {};

  rows.forEach((r, index) => {
    const entry = entryByRow[index];
    const dateKey = buildPeriodKey(new Date(r.transaction_date), groupInterval);
    const key = `${r.part_sku}_${dateKey}`;

    if (!metricsByKey[key]) {
      metricsByKey[key] = {
        month: dateKey,
        itemCode: r.part_sku,
        itemName: r.item_name || '',
        qtyBought: 0,
        qtySold: 0,
        amountBought: 0,
        amountSold: 0,
        totalCogs: 0,
      };
    }
    const m = metricsByKey[key];

    const negative = entry.isAdjustment && entry.adjSign === -1;
    const qty = negative ? -Number(entry.qty) : Number(entry.qty);
    const amount = negative
      ? -Number(entry.preVatAmount)
      : Number(entry.preVatAmount);

    if (r.direction === 'IN') {
      m.qtyBought += qty;
      m.amountBought += amount;
    } else {
      m.qtySold += qty;
      m.amountSold += amount;
      m.totalCogs += entry.calculatedCogs ?? 0;
    }
  });

  return Object.values(metricsByKey);
}
