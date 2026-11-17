/** Một dòng công nợ phải trả, gom theo biển số xe. */
export interface SupplierDebtRow {
  id: string;
  licensePlate: string;
  customerCode: string;
  customerName: string;
  branchExternalId: string;
  caseCount: number;
  vehicleCount: number;
  costAmount: number;
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
