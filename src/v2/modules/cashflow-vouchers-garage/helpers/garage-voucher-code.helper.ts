import type { CashflowVoucherType } from '@/v2/core/cashflow-vouchers-core';

/** Tiền tố mã phiếu: PT-GARA (thu), PC-GARA (chi), theo quy tắc V1. */
export function voucherCodePrefix(
  type: CashflowVoucherType,
  transDate: string,
): string {
  const head = type === 'RECEIPT' ? 'PT-GARA' : 'PC-GARA';
  const yymmdd = transDate.slice(0, 10).replace(/-/g, '').slice(2);
  return `${head}-${yymmdd}`;
}

/** `PT-GARA-261117-001`: số thứ tự 3 chữ số, vượt 999 thì dài thêm. */
export function formatVoucherCode(prefix: string, seq: number): string {
  return `${prefix}-${String(seq).padStart(3, '0')}`;
}
