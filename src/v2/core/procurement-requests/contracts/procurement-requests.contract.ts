import type { TransitionRule } from '../../approval/approval.engine';

/** Hợp đồng lõi họ procurement-requests: các trường mà mọi module con phải có. */
export interface BasePurchaseRequestContract {
  id: string;
  requestNo: string;
  status: PurchaseRequestStatus;
  orderingStatus: PurchaseRequestOrderingStatus;
  createdBy: string | null;
  isDeleted: boolean;
}

/** Trục duyệt: vòng đời chứng từ. */
export const PURCHASE_REQUEST_STATUS = {
  DRAFT: 'DRAFT',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  CLOSED: 'CLOSED',
  CANCELLED: 'CANCELLED',
} as const;
export type PurchaseRequestStatus =
  (typeof PURCHASE_REQUEST_STATUS)[keyof typeof PURCHASE_REQUEST_STATUS];

/** Trục đặt hàng: tiến độ tạo PO, suy ra từ dòng, không sửa tay. */
export const PURCHASE_REQUEST_ORDERING_STATUS = {
  NONE: 'NONE',
  PARTIAL: 'PARTIAL',
  FULL: 'FULL',
} as const;
export type PurchaseRequestOrderingStatus =
  (typeof PURCHASE_REQUEST_ORDERING_STATUS)[keyof typeof PURCHASE_REQUEST_ORDERING_STATUS];

export type PurchaseRequestAction =
  | 'submit'
  | 'recall'
  | 'approve'
  | 'reject'
  | 'cancel'
  | 'close';

/** Bảng chuyển trạng thái theo hành động. */
export const PURCHASE_REQUEST_TRANSITIONS: Record<
  PurchaseRequestAction,
  TransitionRule
> = {
  submit: { from: ['DRAFT'], to: 'PENDING_APPROVAL' },
  recall: { from: ['PENDING_APPROVAL'], to: 'DRAFT' },
  approve: { from: ['PENDING_APPROVAL'], to: 'APPROVED' },
  reject: { from: ['PENDING_APPROVAL'], to: 'DRAFT' },
  cancel: { from: ['PENDING_APPROVAL', 'APPROVED'], to: 'CANCELLED' },
  close: { from: ['APPROVED'], to: 'CLOSED' },
};

/** Hành động bắt buộc có lý do. */
export const PURCHASE_REQUEST_ACTIONS_REQUIRING_REASON: readonly PurchaseRequestAction[] =
  ['reject', 'cancel', 'close'];

/** Hành động cần người duyệt khác người tạo. */
export const PURCHASE_REQUEST_ACTIONS_REQUIRING_APPROVER: readonly PurchaseRequestAction[] =
  ['approve', 'reject'];

/** Mã loại chứng từ ghi trong nhật ký duyệt (erp_approval_events.doc_type). */
export const PURCHASE_REQUEST_DOC_TYPE = 'PROCUREMENT_REQUEST';
