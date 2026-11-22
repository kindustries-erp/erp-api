import type { EntityManager } from 'typeorm';

/**
 * Hợp đồng lõi orchestrator procurement-flow-core: các cổng mà module con ghép vào.
 * Lõi không biết service cụ thể: module con khai báo cổng rồi nối vào service của nó.
 */

/** Một sự kiện nghiệp vụ phát SAU khi transaction đã commit. */
export interface ProcurementFlowEvent {
  /** Loại sự kiện, ví dụ GOODS_RECEIPT_POSTED. */
  type: string;
  documentType: string;
  documentId: string;
  actorId?: string | null;
  payload?: Record<string, unknown>;
}

/** Cổng phát sự kiện. Lỗi phát chỉ được ghi log, không làm hỏng transaction đã commit. */
export interface ProcurementFlowEventPort {
  publish(event: ProcurementFlowEvent): Promise<void>;
}

/** Một dòng nhận hàng gắn vào dòng đơn mua. */
export interface ProcurementFlowFulfilmentItem {
  orderLineId: string;
  qty: number;
}

/** Một dòng di chuyển tồn do phiếu nhận hàng tạo ra. */
export interface ProcurementFlowStockLine {
  itemCode: string;
  itemName: string;
  unit: string;
  qty: number;
  unitCost: number;
}

/** Chứng từ gốc của một lần ghi hoặc đảo sổ tồn. */
export interface ProcurementFlowStockDocument {
  branchId: string | null;
  documentType: string;
  documentId: string;
  transactionDate: Date;
  createdBy: string | null;
}

export interface ProcurementFlowStockInput extends ProcurementFlowStockDocument {
  lines: ProcurementFlowStockLine[];
}

/** Cổng ghi và đảo sổ tồn. Chạy trong transaction của luồng, không tự mở transaction. */
export interface ProcurementReceiptStockPort {
  post(manager: EntityManager, input: ProcurementFlowStockInput): Promise<void>;
  reverse(
    manager: EntityManager,
    document: ProcurementFlowStockDocument,
  ): Promise<void>;
}

/** Cổng nhận hàng vào đơn mua và hoàn lại khi hủy. Chạy trong transaction của luồng. */
export interface ProcurementOrderFulfilmentPort {
  applyGoodsReceipt(
    manager: EntityManager,
    orderId: string,
    items: ProcurementFlowFulfilmentItem[],
  ): Promise<unknown>;
  revertGoodsReceipt(
    manager: EntityManager,
    orderId: string,
    items: ProcurementFlowFulfilmentItem[],
  ): Promise<unknown>;
}

/** Đầu vào một lần nhận hàng: đơn mua nguồn (nếu có) và phần ghi sổ tồn. */
export interface ProcurementFlowReceiptInput {
  /** Đơn mua nguồn. Phiếu nhập không gắn đơn thì để null: chỉ ghi sổ tồn. */
  orderId: string | null;
  items: ProcurementFlowFulfilmentItem[];
  stock: ProcurementFlowStockInput;
}

export const PROCUREMENT_FLOW_EVENTS = {
  receiptPosted: 'GOODS_RECEIPT_POSTED',
  receiptCancelled: 'GOODS_RECEIPT_CANCELLED',
} as const;

/**
 * Cổng "lưu rồi hành động" của orchestrator: `save` tạo hoặc cập nhật chứng từ, `act` chạy hành động
 * (gửi duyệt, ghi nhận, ghi sổ). Cả hai nhận cùng `manager` nên nằm trong một transaction:
 * lỗi ở `act` thì `save` cũng rollback, không để lại chứng từ nháp mồ côi.
 */
export interface SaveAndActPort<TInput, TDoc> {
  /** `id` null = tạo mới; có id = cập nhật chứng từ nháp. Trả về id chứng từ đã lưu. */
  save(
    manager: EntityManager,
    id: string | null,
    input: TInput,
  ): Promise<{ id: string }>;
  /** Hành động sau khi lưu. Gom sự kiện qua `emit`, lõi phát sau commit. */
  act(
    manager: EntityManager,
    emit: (event: ProcurementFlowEvent) => void,
    id: string,
  ): Promise<TDoc>;
}
