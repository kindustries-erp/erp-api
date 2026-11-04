/**
 * Hợp đồng dùng chung của lõi Đơn mua hàng (PO) v2.
 * Trạng thái và bảng chuyển trạng thái nằm ở đây, KHÔNG nằm trong service,
 * để v1 và các module v2 cùng dùng một luật.
 */

export const PURCHASE_ORDER_STATUS = {
  DRAFT: 'DRAFT',
  APPROVED: 'APPROVED',
  CONFIRMED: 'CONFIRMED',
  PARTIAL_RECEIVED: 'PARTIAL_RECEIVED',
  RECEIVED: 'RECEIVED',
  CANCELLED: 'CANCELLED',
} as const;

export type PurchaseOrderStatus =
  (typeof PURCHASE_ORDER_STATUS)[keyof typeof PURCHASE_ORDER_STATUS];

/** Hành động thay đổi trạng thái (endpoint riêng, không qua PATCH). */
export type PurchaseOrderAction = 'approve' | 'confirm' | 'cancel';

/**
 * Bảng chuyển trạng thái do hành động quyết định.
 * - DRAFT → APPROVED | CONFIRMED (có thể bỏ qua APPROVED)
 * - APPROVED → CONFIRMED
 * - APPROVED | CONFIRMED | PARTIAL_RECEIVED → CANCELLED (kiểm tra phụ thuộc ở service)
 * DRAFT không hủy được: phải xóa (đúng hành vi v1).
 */
export const PURCHASE_ORDER_TRANSITIONS: Record<
  PurchaseOrderAction,
  { from: readonly PurchaseOrderStatus[]; to: PurchaseOrderStatus }
> = {
  approve: {
    from: [PURCHASE_ORDER_STATUS.DRAFT],
    to: PURCHASE_ORDER_STATUS.APPROVED,
  },
  confirm: {
    from: [PURCHASE_ORDER_STATUS.DRAFT, PURCHASE_ORDER_STATUS.APPROVED],
    to: PURCHASE_ORDER_STATUS.CONFIRMED,
  },
  cancel: {
    from: [
      PURCHASE_ORDER_STATUS.APPROVED,
      PURCHASE_ORDER_STATUS.CONFIRMED,
      PURCHASE_ORDER_STATUS.PARTIAL_RECEIVED,
    ],
    to: PURCHASE_ORDER_STATUS.CANCELLED,
  },
};

/** Trạng thái đã nhận hàng: không cho sửa dòng, không cho hủy. */
export const PURCHASE_ORDER_RECEIVED_STATUSES: readonly PurchaseOrderStatus[] =
  [PURCHASE_ORDER_STATUS.RECEIVED];

/** Trạng thái không cho sửa header/lines. */
export const PURCHASE_ORDER_LOCKED_STATUSES: readonly PurchaseOrderStatus[] = [
  PURCHASE_ORDER_STATUS.RECEIVED,
  PURCHASE_ORDER_STATUS.CANCELLED,
];

export interface IPurchaseOrderLine {
  id?: string;
  lineNo: number;
  qtyOrdered: string;
  qtyReceived: string;
  unitPrice: string | null;
  amount: string | null;
}

export interface IPurchaseOrderHeader {
  id: string;
  poNo: string;
  status: string;
  isDeleted: boolean;
}

/**
 * Điểm mở rộng để module con (v2 PO, garage PO, và v1 sau này) tùy biến
 * mà không sửa lõi. Mọi hook đều tùy chọn, mặc định là không làm gì.
 */
export interface PurchaseOrderDomainHooks<H extends IPurchaseOrderHeader> {
  /** Ném lỗi nếu hủy PO không được phép (ví dụ đã có phiếu nhập liên kết). */
  assertCanCancel?(header: H): Promise<void>;
}
