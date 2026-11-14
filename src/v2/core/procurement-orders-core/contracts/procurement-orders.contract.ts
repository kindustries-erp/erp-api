import type { TransitionRule } from '../../approval-core/approval.engine';

/** Hợp đồng lõi họ procurement-orders: các trường mà mọi module con phải có. */
export interface BaseProcurementOrderContract {
  id: string;
  orderNo: string;
  status: ProcurementOrderStatus;
  fulfillmentStatus: ProcurementFulfillmentStatus;
  createdBy: string | null;
  isDeleted: boolean;
}

/** Trục duyệt và phát hành. */
export const PROCUREMENT_ORDER_STATUS = {
  DRAFT: 'DRAFT',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  ISSUED: 'ISSUED',
  CLOSED: 'CLOSED',
  CANCELLED: 'CANCELLED',
} as const;
export type ProcurementOrderStatus =
  (typeof PROCUREMENT_ORDER_STATUS)[keyof typeof PROCUREMENT_ORDER_STATUS];

/** Trục giao nhận, suy ra từ dòng. */
export const PROCUREMENT_FULFILLMENT_STATUS = {
  NONE: 'NONE',
  PARTIAL: 'PARTIAL',
  FULL: 'FULL',
} as const;
export type ProcurementFulfillmentStatus =
  (typeof PROCUREMENT_FULFILLMENT_STATUS)[keyof typeof PROCUREMENT_FULFILLMENT_STATUS];

export type ProcurementOrderAction =
  | 'submit'
  | 'recall'
  | 'approve'
  | 'reject'
  | 'issue'
  | 'cancel'
  | 'close';

export const PROCUREMENT_ORDER_TRANSITIONS: Record<
  ProcurementOrderAction,
  TransitionRule
> = {
  submit: { from: ['DRAFT'], to: 'PENDING_APPROVAL' },
  recall: { from: ['PENDING_APPROVAL'], to: 'DRAFT' },
  approve: { from: ['PENDING_APPROVAL'], to: 'APPROVED' },
  reject: { from: ['PENDING_APPROVAL'], to: 'REJECTED' },
  issue: { from: ['APPROVED'], to: 'ISSUED' },
  cancel: { from: ['APPROVED', 'ISSUED'], to: 'CANCELLED' },
  close: { from: ['ISSUED'], to: 'CLOSED' },
};

export const PROCUREMENT_ORDER_ACTIONS_REQUIRING_REASON: readonly ProcurementOrderAction[] =
  ['reject', 'cancel', 'close'];

export const PROCUREMENT_ORDER_ACTIONS_REQUIRING_APPROVER: readonly ProcurementOrderAction[] =
  ['approve', 'reject'];

/** Nguồn gốc PO. */
export const PROCUREMENT_ORDER_SOURCE = {
  DIRECT: 'DIRECT',
  REQUEST: 'REQUEST',
} as const;
export type ProcurementOrderSource =
  (typeof PROCUREMENT_ORDER_SOURCE)[keyof typeof PROCUREMENT_ORDER_SOURCE];
