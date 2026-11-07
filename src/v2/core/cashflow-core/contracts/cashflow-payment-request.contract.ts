import type { TransitionRule } from '../../approval-core/approval.engine';
import type { CashflowForecastAction } from './cashflow-core.contract';

/**
 * Đề nghị thanh toán (DNTT). Trạng thái khác dự chi: duyệt xong là APPROVED (chờ chi), không phải OPEN.
 * PARTIAL và PAID do tổng thực chi quyết định, không có hành động trực tiếp.
 */
export const CASHFLOW_PAYMENT_REQUEST_STATUS = {
  DRAFT: 'DRAFT',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  REJECTED: 'REJECTED',
  APPROVED: 'APPROVED',
  PARTIAL: 'PARTIAL',
  PAID: 'PAID',
  CANCELLED: 'CANCELLED',
} as const;

export type CashflowPaymentRequestStatus =
  (typeof CASHFLOW_PAYMENT_REQUEST_STATUS)[keyof typeof CASHFLOW_PAYMENT_REQUEST_STATUS];

/** Mã loại chứng từ ghi trong nhật ký duyệt và khóa cấu hình duyệt. */
export const CASHFLOW_PAYMENT_REQUEST_DOC_TYPE = 'CASHFLOW_PAYMENT_REQUEST';

/** DNTT mặc định cần duyệt (khác dự thu tắt, dự chi bật). */
export const DEFAULT_PAYMENT_REQUEST_APPROVAL_ENABLED = true;

/**
 * Bảng chuyển trạng thái DNTT. `cancel` từ APPROVED chỉ hợp lệ khi chưa có thực chi
 * (kiểm tra ở beforeTransition của module).
 */
export const CASHFLOW_PAYMENT_REQUEST_TRANSITIONS: Record<
  CashflowForecastAction,
  TransitionRule
> = {
  submit: { from: ['DRAFT', 'REJECTED'], to: 'PENDING_APPROVAL' },
  recall: { from: ['PENDING_APPROVAL'], to: 'DRAFT' },
  approve: { from: ['PENDING_APPROVAL'], to: 'APPROVED' },
  reject: { from: ['PENDING_APPROVAL'], to: 'REJECTED' },
  cancel: { from: ['DRAFT', 'REJECTED', 'APPROVED'], to: 'CANCELLED' },
};

/** Hành động bắt buộc có lý do: giống dự chi. */
export const CASHFLOW_PAYMENT_REQUEST_ACTIONS_REQUIRING_REASON: readonly CashflowForecastAction[] =
  ['reject', 'cancel'];
