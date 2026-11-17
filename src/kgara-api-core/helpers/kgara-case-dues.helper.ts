/**
 * Phần phải thu của một phiếu Kgara theo từng bên (KH / BH).
 * Dùng chung cho bảng phân tích công nợ, writer phiếu thu và script backfill payer_type.
 */

export interface CaseDues {
  dueKH: number;
  dueBH: number;
}

type RawData = Record<string, unknown> | null | undefined;

function num(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

export function getCaseReceivableDues(
  raw: RawData,
  netRevenue: number | string | null | undefined,
): CaseDues {
  const data = raw ?? {};
  const net = Number(netRevenue) || 0;

  let dueBH = 0;
  const bhExplicit = num(data.TienThanhToanBH);
  const bhApproved = num(data.TienBaoHiemDuyet);
  if (bhExplicit != null) {
    dueBH = bhExplicit;
  } else if (data.XeLamBaoHiem === true && bhApproved != null) {
    dueBH = Math.max(0, bhApproved);
  }

  let dueKH = 0;
  const khExplicit = num(data.TienThanhToanKH);
  if (khExplicit != null) {
    dueKH = khExplicit;
  } else if (!data.XeLamBaoHiem) {
    dueKH = net;
  } else {
    dueKH = Math.max(0, net - dueBH);
  }

  return { dueKH, dueBH };
}
