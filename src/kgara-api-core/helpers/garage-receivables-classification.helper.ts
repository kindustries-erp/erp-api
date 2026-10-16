/**
 * Pure Engine Helper trích xuất theo chuẩn /api-service-refactor
 * Tính toán 4 nhóm phân loại nghiệp vụ & chi phí (TrendItem) từ danh sách cases
 */
export interface CaseClassificationTotals {
  caseCount: number;
  billed: number;
  paid: number;
  receivable: number;
  receivableWithInvoice: number;
  receivableNoInvoice: number;
  cost: number;
  paidCost: number;
  payableCost: number;
  payableCostWithInvoice: number;
  payableCostNoInvoice: number;
}

function emptyClassificationTotals(): CaseClassificationTotals {
  return {
    caseCount: 0,
    billed: 0,
    paid: 0,
    receivable: 0,
    receivableWithInvoice: 0,
    receivableNoInvoice: 0,
    cost: 0,
    paidCost: 0,
    payableCost: 0,
    payableCostWithInvoice: 0,
    payableCostNoInvoice: 0,
  };
}

function populateGroup(
  res: any,
  prefix: string,
  g: CaseClassificationTotals,
  rate: (p: number, t: number) => number,
) {
  res[`caseCount${prefix}`] = g.caseCount;
  res[`billed${prefix}`] = g.billed;
  res[`paid${prefix}`] = g.paid;
  res[`receivable${prefix}`] = g.receivable;
  res[`receivableWithInvoice${prefix}`] = g.receivableWithInvoice;
  res[`receivableNoInvoice${prefix}`] = g.receivableNoInvoice;
  res[`rate${prefix}`] = rate(g.paid, g.billed);
  res[`cost${prefix}`] = g.cost;
  res[`paidCost${prefix}`] = g.paidCost;
  res[`payableCost${prefix}`] = g.payableCost;
  res[`payableCostWithInvoice${prefix}`] = g.payableCostWithInvoice;
  res[`payableCostNoInvoice${prefix}`] = g.payableCostNoInvoice;
  res[`costRate${prefix}`] = rate(g.paidCost, g.cost);
}

export function buildReceivablesTrendItem(
  label: string,
  cases: any[],
  gpCostByCaseId: Map<string, number> = new Map(),
  caseHasInvoiceMap: Map<string, boolean> = new Map(),
  paidCostByCaseId: Map<string, number> = new Map(),
): any {
  const groups = {
    SUA_CHUA_CHUNG: emptyClassificationTotals(),
    KY_GUI_NOI_BO: emptyClassificationTotals(),
    OJ_NGOAI: emptyClassificationTotals(),
    OTHER: emptyClassificationTotals(),
  };

  let totalBilled = 0;
  let totalPaid = 0;
  let totalCost = 0;
  let totalPaidCost = 0;

  for (const c of cases) {
    let key: keyof typeof groups = 'OTHER';
    if (c.classification === 'SUA_CHUA_CHUNG') key = 'SUA_CHUA_CHUNG';
    else if (['KY_GUI_NOI_BO', 'KY_GUI', 'NOI_BO'].includes(c.classification))
      key = 'KY_GUI_NOI_BO';
    else if (['OJ', 'OJ_NGOAI'].includes(c.classification)) key = 'OJ_NGOAI';

    const g = groups[key];
    g.caseCount += 1;

    const billed = c.excludeFromDebt
      ? 0
      : Number(c.tienCoThue || c.tien_co_thue || 0);
    const paid = c.excludeFromDebt
      ? 0
      : Number(c.tienDaThanhToan || c.tien_da_thanh_toan || 0);
    const remaining = c.excludeFromDebt ? 0 : Math.max(0, billed - paid);

    const cost = gpCostByCaseId.get(c.id) ?? Number(c.chiPhi || c.chi_phi || 0);
    const paidCost = paidCostByCaseId.get(c.id) ?? 0;
    const remainingCost = Math.max(0, cost - paidCost);

    const rawTax = c.rawData?.TienThueKH ?? c.raw_data?.TienThueKH;
    const hasInvoice =
      (rawTax && !isNaN(Number(rawTax)) && Number(rawTax) > 0) ||
      Boolean(caseHasInvoiceMap.get(c.id));

    g.billed += billed;
    g.paid += paid;
    g.receivable += remaining;
    if (hasInvoice) {
      g.receivableWithInvoice += remaining;
      g.payableCostWithInvoice += remainingCost;
    } else {
      g.receivableNoInvoice += remaining;
      g.payableCostNoInvoice += remainingCost;
    }

    g.cost += cost;
    g.paidCost += paidCost;
    g.payableCost += remainingCost;

    totalBilled += billed;
    totalPaid += paid;
    totalCost += cost;
    totalPaidCost += paidCost;
  }

  const rate = (paid: number, total: number) =>
    total > 0 ? Math.round((paid / total) * 1000) / 10 : 0;

  const result: any = {
    label,
    totalBilled,
    tienCoThue: totalBilled,
    paid: totalPaid,
    receivable: Math.max(0, totalBilled - totalPaid),
    collectionRate: rate(totalPaid, totalBilled),
    cost: totalCost,
    paidCost: totalPaidCost,
    payableCost: Math.max(0, totalCost - totalPaidCost),
    costPaymentRate: rate(totalPaidCost, totalCost),
    caseCount: cases.length,
    revenue: totalBilled,
    profit: totalBilled - totalCost,
    margin:
      totalBilled > 0
        ? Math.round(((totalBilled - totalCost) / totalBilled) * 1000) / 10
        : 0,
    collectionRateDiff: 0,
    costPaymentRateDiff: 0,
  };

  populateGroup(result, 'SuaChuaChung', groups.SUA_CHUA_CHUNG, rate);
  populateGroup(result, 'KyGuiNoiBo', groups.KY_GUI_NOI_BO, rate);
  populateGroup(result, 'Oj', groups.OJ_NGOAI, rate);
  populateGroup(result, 'Other', groups.OTHER, rate);

  return result;
}
