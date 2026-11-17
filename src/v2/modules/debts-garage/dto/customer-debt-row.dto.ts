/** Một dòng công nợ phải thu, gom theo biển số xe. Số tiền là number (đã làm tròn 2 chữ số). */
export interface CustomerDebtRow {
  licensePlate: string;
  customerCode: string;
  customerName: string;
  branchExternalId: string | null;
  caseCount: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  latestDate: string | null;
  oldestDate: string | null;
  maxAgingDays: number;
  aging0_30: number;
  aging31_60: number;
  aging61_90: number;
  agingOver90: number;
}
