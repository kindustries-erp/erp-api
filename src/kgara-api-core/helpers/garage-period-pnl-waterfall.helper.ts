import type { PnlMonthRow } from './garage-pnl-month.helper';

/** Nhóm của một bước: cùng nhóm thì cùng màu trong waterfall. */
export type WaterfallGroup =
  | 'revenue'
  | 'cogs'
  | 'profit'
  | 'selling'
  | 'opex'
  | 'commission';

/** Một bước của waterfall: tổng (cột từ 0) hoặc giảm (cột trôi từ số dư trước). */
export interface WaterfallStep {
  label: string;
  value: number;
  kind: 'total' | 'decrease';
  group: WaterfallGroup;
}

/** Phần dương và âm của một nhóm, theo từng bước (0 khi bước không thuộc nhóm). */
export interface WaterfallGroupSeries {
  group: WaterfallGroup;
  name: string;
  color: string;
  pos: number[];
  neg: number[];
}

/** Chuỗi cột chồng của waterfall: nền vô hình, rồi một cặp dương/âm cho mỗi nhóm. */
export interface WaterfallSeries {
  categories: string[];
  base: number[];
  groups: WaterfallGroupSeries[];
}

/** Màu theo nhóm, lấy từ bảng màu chart sẵn có. */
export const WATERFALL_GROUP_STYLE: Record<
  WaterfallGroup,
  { name: string; color: string }
> = {
  revenue: { name: 'Doanh thu', color: '059669' },
  cogs: { name: 'Giá vốn', color: 'E11D48' },
  profit: { name: 'Lợi nhuận', color: '475569' },
  selling: { name: 'Chi phí bán hàng', color: 'EA580C' },
  opex: { name: 'Chi phí vận hành', color: '7C3AED' },
  commission: { name: 'Hoa hồng DV', color: 'CA8A04' },
};

const SALE_KEY = 'HOA_HONG_SALE';
const GROUP_ORDER: WaterfallGroup[] = [
  'revenue',
  'cogs',
  'profit',
  'selling',
  'opex',
  'commission',
];

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
    { label: 'Doanh thu', value: m.revenue, kind: 'total', group: 'revenue' },
    { label: 'Giá vốn', value: m.cogs, kind: 'decrease', group: 'cogs' },
    {
      label: 'Lợi nhuận gộp',
      value: m.grossProfit,
      kind: 'total',
      group: 'profit',
    },
    {
      label: 'Chi phí bán hàng',
      value: selling,
      kind: 'decrease',
      group: 'selling',
    },
    {
      label: 'Chi phí vận hành',
      value: m.opexTotal,
      kind: 'decrease',
      group: 'opex',
    },
    { label: 'Lợi nhuận ròng', value: net1, kind: 'total', group: 'profit' },
    {
      label: 'Hoa hồng DV',
      value: Math.round(m.commissionTotal - saleAmount),
      kind: 'decrease',
      group: 'commission',
    },
    {
      label: 'LN sau hoa hồng',
      value: m.netAfterCommission,
      kind: 'total',
      group: 'profit',
    },
  ];
}

/**
 * Chuyển các bước thành chuỗi cột chồng. Mỗi cột có đáy vô hình và đoạn nằm trên hoặc dưới mốc 0
 * (cột vắt qua 0 được tách phần dương và phần âm). Mỗi nhóm có một cặp series cùng màu. Nhãn trục
 * có hai dòng: tên bước, rồi số tiền và % trên doanh thu.
 */
export function buildWaterfallSeries(
  steps: WaterfallStep[],
  revenue: number,
): WaterfallSeries {
  const n = steps.length;
  const zeros = () => Array.from({ length: n }, () => 0);
  const groups: WaterfallGroupSeries[] = GROUP_ORDER.map((group) => ({
    group,
    name: WATERFALL_GROUP_STYLE[group].name,
    color: WATERFALL_GROUP_STYLE[group].color,
    pos: zeros(),
    neg: zeros(),
  }));
  const out: WaterfallSeries = { categories: [], base: zeros(), groups };
  let running = 0;
  steps.forEach((step, i) => {
    const end = step.kind === 'total' ? step.value : running - step.value;
    const start = step.kind === 'total' ? 0 : running;
    running = end;
    const lo = Math.min(start, end);
    const hi = Math.max(start, end);
    const share =
      revenue > 0
        ? ` · ${((step.value / revenue) * 100).toFixed(1).replace('.', ',')}%`
        : '';
    out.categories.push(`${step.label}\n${compactMoney(step.value)}${share}`);

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
    out.base[i] = base;
    const target = groups.find((g) => g.group === step.group)!;
    target.pos[i] = pos;
    target.neg[i] = neg;
  });
  return out;
}
