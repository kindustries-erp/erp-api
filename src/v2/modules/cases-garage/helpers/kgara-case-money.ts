/**
 * Tiền doanh thu, chi phí, lợi nhuận của một vụ việc KGara khi chiếu sang `cases_garage`.
 * Cùng quy tắc với dashboard V1 (`garage-checkpoint.service.ts`): ưu tiên bảng lợi nhuận gộp,
 * rồi đến cột của vụ việc, rồi 0. Lợi nhuận thiếu thì tính doanh thu trừ chi phí.
 */
export interface KgaraCaseMoneySource {
  doanhThu: number | null;
  tienCoThue: number | null;
  chiPhi: number | null;
  loiNhuan: number | null;
}

export interface KgaraGrossProfitMoneySource {
  doanhThu: number | null;
  chiPhi: number | null;
  loiNhuan: number | null;
}

export interface KgaraCaseMoney {
  revenue: number;
  cost: number;
  profit: number;
}

export function resolveKgaraCaseMoney(
  v1: KgaraCaseMoneySource,
  gp: KgaraGrossProfitMoneySource | null | undefined,
): KgaraCaseMoney {
  const revenue = gp?.doanhThu ?? v1.doanhThu ?? v1.tienCoThue ?? 0;
  const cost = gp?.chiPhi ?? v1.chiPhi ?? 0;
  const profit = gp?.loiNhuan ?? v1.loiNhuan ?? revenue - cost;
  return { revenue, cost, profit };
}
