/**
 * Hợp đồng phân bổ thanh toán vào khoản nợ.
 * Mỗi phân bổ có `idempotencyKey` duy nhất: gửi lại cùng khóa không được trừ nợ lần thứ hai.
 */

/** Nguồn tiền của một phân bổ. */
export type DebtAllocationSource =
  | 'CASHFLOW_VOUCHER'
  | 'BANK_TRANSACTION'
  | 'INVOICE_NETOFF'
  | 'MANUAL';

export interface DebtAllocation {
  id: string;
  debtId: string;
  sourceType: DebtAllocationSource;
  /** Mã chứng từ nguồn (phiếu thu/chi, giao dịch ngân hàng...). Null khi nhập tay. */
  sourceId: string | null;
  /** Luôn dương. Hướng thu hay chi do khoản nợ quyết định, không do dấu của số tiền. */
  amount: number;
  idempotencyKey: string;
  allocatedAt: Date | string;
  /** Có giá trị nghĩa là phân bổ đã bị đảo; không tính vào số dư. */
  reversedAt: Date | string | null;
}
