import {
  parseFilterRecord,
  TableColumnMap,
  TableFilterPayload,
  TableSummaryColumn,
} from '@/common/utils/table-query';

/**
 * Whitelist cột bảng Khoản vay (`loans_finance`, alias `loan`).
 * Khóa camelCase khớp `LoansTable.columns.tsx` phía Web, kèm alias snake_case.
 */
export const TABLE_COLUMNS: TableColumnMap = {
  loanCode: { sql: 'loan.loanCode', type: 'text' },
  loan_code: { sql: 'loan.loanCode', type: 'text' },
  title: { sql: 'loan.title', type: 'text' },
  lenderName: { sql: 'loan.lenderName', type: 'text' },
  lender_name: { sql: 'loan.lenderName', type: 'text' },
  principalAmount: { sql: 'loan.principalAmount', type: 'number' },
  principal_amount: { sql: 'loan.principalAmount', type: 'number' },
  totalPaidPrincipal: { sql: 'loan.totalPaidPrincipal', type: 'number' },
  total_paid_principal: { sql: 'loan.totalPaidPrincipal', type: 'number' },
  totalPaidInterest: { sql: 'loan.totalPaidInterest', type: 'number' },
  total_paid_interest: { sql: 'loan.totalPaidInterest', type: 'number' },
  remainingPrincipal: { sql: 'loan.remainingPrincipal', type: 'number' },
  remaining_principal: { sql: 'loan.remainingPrincipal', type: 'number' },
  annualInterestRate: { sql: 'loan.annualInterestRate', type: 'number' },
  annual_interest_rate: { sql: 'loan.annualInterestRate', type: 'number' },
  tenorMonths: { sql: 'loan.tenorMonths', type: 'number' },
  tenor_months: { sql: 'loan.tenorMonths', type: 'number' },
  amortizationMethod: { sql: 'loan.amortizationMethod', type: 'status' },
  amortization_method: { sql: 'loan.amortizationMethod', type: 'status' },
  startDate: { sql: 'loan.startDate', type: 'date' },
  start_date: { sql: 'loan.startDate', type: 'date' },
  firstPaymentDate: { sql: 'loan.firstPaymentDate', type: 'date' },
  first_payment_date: { sql: 'loan.firstPaymentDate', type: 'date' },
  status: { sql: 'loan.status', type: 'status' },
  notes: { sql: 'loan.notes', type: 'text' },
  createdAt: { sql: 'loan.createdAt', type: 'date' },
  created_at: { sql: 'loan.createdAt', type: 'date' },
};

export const SEARCH_COLUMNS = [
  'loan.loanCode',
  'loan.title',
  'loan.lenderName',
];

/** Cột số được cộng vào `summaries` trên toàn bộ dòng khớp bộ lọc. */
export const SUMMARY_COLUMNS: TableSummaryColumn[] = [
  { key: 'principalAmount', sql: 'loan.principalAmount' },
  { key: 'totalPaidPrincipal', sql: 'loan.totalPaidPrincipal' },
  { key: 'remainingPrincipal', sql: 'loan.remainingPrincipal' },
  { key: 'totalPaidInterest', sql: 'loan.totalPaidInterest' },
];

/** Chuyển raw filter JSON thành envelope TableFilterPayload cho options query. */
export function toFilterPayload(raw: unknown): TableFilterPayload {
  const parsed = parseFilterRecord<
    TableFilterPayload & Record<string, unknown>
  >(raw);
  if (!parsed) return {};
  const hasEnvelope = [
    'columnFilters',
    'columnSearch',
    'columnOperators',
    'dateRanges',
  ].some((key) => key in parsed);
  return hasEnvelope
    ? parsed
    : { columnFilters: parsed as Record<string, string[]> };
}
