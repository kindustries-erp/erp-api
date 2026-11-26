/** Một dòng phiếu thu chi trả ra API (không lộ entity). Tiền là number. */
export interface CashflowVoucherGarageRow {
  id: string;
  branchExternalId: string | null;
  voucherCode: string;
  voucherType: 'RECEIPT' | 'PAYMENT';
  status: string;
  transDate: string;
  amount: number;
  caseId: string | null;
  licensePlate: string | null;
  paymentMethod: string | null;
  paymentContent: string | null;
  partnerName: string | null;
  payerType: string;
  note: string | null;
  source: string;
  createdBy: string | null;
  isAutoExpected: boolean;
  createdAt: string;
}

/** Số tổng của kỳ lọc (phiếu đã hủy không tính). */
export interface CashflowDashboardGarage {
  receiptPaid: number;
  paymentPaid: number;
  netPaid: number;
  receiptExpected: number;
  paymentExpected: number;
  voucherCount: number;
}

export interface CashflowDuplicateItem {
  id: string;
  voucherCode: string;
  voucherType: string;
  amount: number;
  transDate: string;
  licensePlate: string | null;
  caseCode: string | null;
  partnerName: string | null;
}

export interface CashflowDuplicateGroup {
  items: CashflowDuplicateItem[];
  total: number;
}

export interface CashflowDuplicateResult {
  nearbyDate: CashflowDuplicateGroup;
  sameCase: CashflowDuplicateGroup;
  samePlate: CashflowDuplicateGroup;
}
