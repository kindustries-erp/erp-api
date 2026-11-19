export interface CaseSettlementSums {
  receipts: number;
  payments: number;
  /** Có ít nhất một settlement RECEIPT. Chỉ PAYMENT thì giữ tien_da_thanh_toan đã lưu. */
  hasReceipt: boolean;
}

export interface CaseLinkCounts {
  total: number;
  outCount: number;
  inCount: number;
}

type Raw = Record<string, unknown> | null | undefined;

/** Số phải thu của bảo hiểm, theo quy tắc V1 trên `raw_data`. */
export function insuranceReceivable(raw: Raw): number {
  const paidByInsurer = raw?.TienThanhToanBH;
  if (paidByInsurer != null && !isNaN(Number(paidByInsurer))) {
    return Number(paidByInsurer);
  }
  const approved = Number(raw?.TienBaoHiemDuyet);
  if (raw?.XeLamBaoHiem === true && approved > 0) return approved;
  return 0;
}

/** Số phải thu của khách hàng, theo quy tắc V1 trên `raw_data`. */
export function customerReceivable(
  raw: Raw,
  netPayable: number,
  insurance: number,
): number {
  const paidByCustomer = raw?.TienThanhToanKH;
  if (paidByCustomer != null && !isNaN(Number(paidByCustomer))) {
    return Number(paidByCustomer);
  }
  if (!raw?.XeLamBaoHiem) return netPayable;
  return Math.max(0, netPayable - insurance);
}
