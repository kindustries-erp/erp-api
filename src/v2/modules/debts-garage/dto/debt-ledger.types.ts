/** Một dòng sổ nợ garage trả ra API (không lộ entity). Tiền là number. */
export interface DebtLedgerRow {
  id: string;
  branchExternalId: string;
  sourceType: string;
  sourceId: string;
  caseId: string | null;
  direction: 'RECEIVABLE' | 'PAYABLE';
  partyType: string;
  partnerId: string | null;
  partyCode: string;
  partyName: string | null;
  licensePlate: string | null;
  originalAmount: number;
  settledAmount: number;
  balanceAmount: number;
  dueBaseDate: string | null;
  status: string;
  excluded: boolean;
  origin: string;
  version: number;
}

/** Một dòng phân bổ của khoản nợ. */
export interface DebtAllocationRow {
  id: string;
  debtId: string;
  sourceType: string;
  sourceId: string | null;
  voucherId: string | null;
  amount: number;
  payerType: string;
  transDate: string | null;
  reversedAt: string | null;
  reversalOfId: string | null;
  origin: string;
  createdAt: string;
}
