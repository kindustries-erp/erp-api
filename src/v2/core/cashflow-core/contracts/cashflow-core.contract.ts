import type { TransitionRule } from '@/v2/core/approval-core/approval.engine';

/** Hợp đồng lõi cashflow-core: các trường mà mọi module con phải có. */
export interface BaseCashflowForecastContract {
  id: string;
  isDeleted: boolean;
  status: string;
}

/** Hành động trên dự thu / dự chi. */
export type CashflowForecastAction =
  | 'submit'
  | 'recall'
  | 'approve'
  | 'reject'
  | 'cancel';

export const CASHFLOW_FORECAST_STATUS = {
  DRAFT: 'DRAFT',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  REJECTED: 'REJECTED',
  OPEN: 'OPEN',
  PARTIAL: 'PARTIAL',
  SETTLED: 'SETTLED',
  CANCELLED: 'CANCELLED',
} as const;

/**
 * Bảng chuyển trạng thái. Hành động đi qua `resolveTransition`, sai trạng thái thì 409.
 * PARTIAL và SETTLED do phân bổ quyết định, không có hành động trực tiếp.
 * `cancel` chỉ hợp lệ khi chưa có phân bổ; kiểm tra phân bổ ở hook `beforeTransition` của module.
 */
export const CASHFLOW_FORECAST_TRANSITIONS: Record<
  CashflowForecastAction,
  TransitionRule
> = {
  submit: { from: ['DRAFT', 'REJECTED'], to: 'PENDING_APPROVAL' },
  recall: { from: ['PENDING_APPROVAL'], to: 'DRAFT' },
  approve: { from: ['PENDING_APPROVAL'], to: 'OPEN' },
  reject: { from: ['PENDING_APPROVAL'], to: 'REJECTED' },
  cancel: { from: ['DRAFT', 'REJECTED', 'OPEN'], to: 'CANCELLED' },
};

/** Hành động bắt buộc có lý do. */
export const CASHFLOW_FORECAST_ACTIONS_REQUIRING_REASON: readonly CashflowForecastAction[] =
  ['reject', 'cancel'];
