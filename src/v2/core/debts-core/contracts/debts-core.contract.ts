/**
 * Hợp đồng lõi orchestrator debts-core: các cổng mà module con ghép vào.
 * Lõi không biết service cụ thể: module con khai báo cổng rồi nối vào service của nó.
 */

/** Một sự kiện nghiệp vụ phát SAU khi transaction đã commit. */
export interface DebtFlowEvent {
  /** Loại sự kiện, ví dụ GOODS_RECEIPT_POSTED. */
  type: string;
  documentType: string;
  documentId: string;
  actorId?: string | null;
  payload?: Record<string, unknown>;
}

/** Cổng phát sự kiện. Lỗi phát chỉ được ghi log, không làm hỏng transaction đã commit. */
export interface DebtFlowEventPort {
  publish(event: DebtFlowEvent): Promise<void>;
}
