import type { PnlMonthRow } from './garage-pnl-month.helper';

/** Một bước của waterfall: tổng (cột từ 0) hoặc giảm (cột trôi từ số dư trước). */
export interface WaterfallStep {
  label: string;
  value: number;
  kind: 'total' | 'decrease';
}

/** Chuỗi cột chồng của waterfall, cùng thứ tự series trong chart. */
export interface WaterfallSeries {
  categories: string[];
  /** Nền vô hình: đệm từ 0 tới đáy của mỗi cột trôi. */
  base: number[];
  /** Phần dương của cột tổng (doanh thu, lợi nhuận). */
  totalPos: number[];
  /** Phần âm của cột tổng (lỗ). */
  totalNeg: number[];
  /** Phần dương của cột giảm (chi phí, hoa hồng). */
  costPos: number[];
  /** Phần âm của cột giảm (vượt qua mức 0). */
  costNeg: number[];
}

const SALE_KEY = 'HOA_HONG_SALE';

/** Số tiền gọn cho nhãn trục: "444,2tr" (triệu), "138k" (nghìn), còn lại giữ nguyên. */
const compactMoney = (value: number) => {
  const abs = Math.abs(value);
  if (abs >= 1_000_000)
    return `${(value / 1_000_000).toFixed(1).replace('.', ',')}tr`;
  if (abs >= 1_000) return `${Math.round(value / 1_000)}k`;
  return `${Math.round(value)}`;
};

/** Các bước từ doanh thu đến lợi nhuận ròng sau hoa hồng, cùng số với bảng lợi nhuận. */
export function buildWaterfallSteps(m: PnlMonthRow): WaterfallStep[] {
  const sale = m.commissionItems.find((c) => c.categoryKey === SALE_KEY);
  const saleAmount = sale?.amount ?? 0;
  const selling = saleAmount + m.hhbhTotal;
  const net1 = m.grossProfit - selling - m.opexTotal;
  return [
    { label: 'Doanh thu', value: m.revenue, kind: 'total' },
    { label: 'Giá vốn', value: m.cogs, kind: 'decrease' },
    { label: 'Lợi nhuận gộp', value: m.grossProfit, kind: 'total' },
    { label: 'Chi phí bán hàng', value: selling, kind: 'decrease' },
    { label: 'Chi phí vận hành', value: m.opexTotal, kind: 'decrease' },
    { label: 'Lợi nhuận ròng', value: net1, kind: 'total' },
    {
      label: 'Hoa hồng DV',
      value: Math.round(m.commissionTotal - saleAmount),
      kind: 'decrease',
    },
    { label: 'LN sau hoa hồng', value: m.netAfterCommission, kind: 'total' },
  ];
}

/**
 * Chuyển các bước thành chuỗi cột chồng. Mỗi cột có đáy (nền) và đoạn nằm trên hoặc dưới mốc
 * 0; cột vắt qua 0 được tách thành phần dương và phần âm. Nhãn trục có tên bước, số tiền và
 * % trên doanh thu.
 */
export function buildWaterfallSeries(
  steps: WaterfallStep[],
  revenue: number,
): WaterfallSeries {
  const out: WaterfallSeries = {
    categories: [],
    base: [],
    totalPos: [],
    totalNeg: [],
    costPos: [],
    costNeg: [],
  };
  let running = 0;
  for (const step of steps) {
    const end = step.kind === 'total' ? step.value : running - step.value;
    const start = step.kind === 'total' ? 0 : running;
    running = end;
    const lo = Math.min(start, end);
    const hi = Math.max(start, end);
    const share =
      revenue > 0
        ? ` · ${((step.value / revenue) * 100).toFixed(1).replace('.', ',')}%`
        : '';
    out.categories.push(`${step.label} · ${compactMoney(step.value)}${share}`);

    let base = 0;
    let pos = 0;
    let neg = 0;
    if (lo >= 0) {
      base = lo;
      pos = hi - lo;
    } else if (hi <= 0) {
      base = hi;
      neg = lo - hi;
    } else {
      pos = hi;
      neg = lo;
    }
    out.base.push(base);
    if (step.kind === 'total') {
      out.totalPos.push(pos);
      out.totalNeg.push(neg);
      out.costPos.push(0);
      out.costNeg.push(0);
    } else {
      out.totalPos.push(0);
      out.totalNeg.push(0);
      out.costPos.push(pos);
      out.costNeg.push(neg);
    }
  }
  return out;
}
