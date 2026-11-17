import type {
  CashflowVoucherStatus,
  CashflowVoucherType,
} from '../entities/base-cashflow-voucher.entity';

/** Dữ liệu tạo phiếu thu chi (đã validate ở DTO của module con). */
export interface CreateCashflowVoucherInput {
  branchExternalId: string;
  voucherType: CashflowVoucherType;
  transDate: string;
  /** Dương. */
  amount: number;
  /** Bỏ trống thì sinh mã tự động. */
  voucherCode?: string | null;
  status?: CashflowVoucherStatus;
  caseId?: string | null;
  licensePlate?: string | null;
  paymentMethod?: string | null;
  paymentContent?: string | null;
  partnerName?: string | null;
  payerType?: string;
  note?: string | null;
  source?: string;
  createdBy?: string | null;
}

/** Trường được sửa khi phiếu còn nháp (EXPECTED/PENDING). */
export type UpdateCashflowVoucherInput = Partial<
  Omit<
    CreateCashflowVoucherInput,
    'branchExternalId' | 'voucherType' | 'voucherCode' | 'source' | 'createdBy'
  >
>;

/** Cổng sinh mã phiếu; module con cài theo quy tắc mã của mình (ví dụ PT-GARA-yymmdd-xxx). */
export interface CashflowVoucherCodePort {
  next(
    voucherType: CashflowVoucherType,
    transDate: string,
    isTaken: (code: string) => Promise<boolean>,
  ): Promise<string>;
}

/** Luồng trạng thái hợp lệ: nháp -> duyệt -> đã thu chi -> hủy; phiếu hủy là cuối. */
export const CASHFLOW_VOUCHER_TRANSITIONS: Record<
  CashflowVoucherStatus,
  CashflowVoucherStatus[]
> = {
  EXPECTED: ['PENDING', 'APPROVED', 'PAID', 'CANCELLED'],
  PENDING: ['APPROVED', 'PAID', 'CANCELLED'],
  APPROVED: ['PAID', 'CANCELLED'],
  PAID: ['CANCELLED'],
  CANCELLED: [],
};
