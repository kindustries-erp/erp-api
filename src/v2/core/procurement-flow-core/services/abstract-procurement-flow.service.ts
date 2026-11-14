import { EntityManager } from 'typeorm';
import type {
  ProcurementFlowEvent,
  ProcurementFlowReceiptInput,
  ProcurementFlowStockDocument,
  ProcurementOrderFulfilmentPort,
  ProcurementReceiptStockPort,
} from '../contracts/procurement-flow-core.contract';
import { PROCUREMENT_FLOW_EVENTS } from '../contracts/procurement-flow-core.contract';
import { AbstractTransactionalFlow } from './abstract-transactional-flow.service';

/**
 * Khung điều phối procurement-flow-core (abstract): chạy các bước trong MỘT transaction, gom sự kiện,
 * và chỉ phát sự kiện sau khi commit. Không có @Injectable và không đăng ký trong lõi:
 * module con kế thừa, khai báo `dataSource`, `events`, `fulfilment`, `stock` bằng Clean DI constructor
 * (một chữ ký, không overload).
 *
 * Lõi chỉ định nghĩa THỨ TỰ bước của chuỗi mua (nhận hàng vào đơn mua, ghi sổ tồn, phát sự kiện).
 * Khóa chứng từ, kiểm hợp lệ và đổi trạng thái phiếu là việc của lớp con.
 */
export abstract class AbstractProcurementFlowService extends AbstractTransactionalFlow {
  protected abstract readonly fulfilment: ProcurementOrderFulfilmentPort;
  protected abstract readonly stock: ProcurementReceiptStockPort;

  /**
   * Nhận hàng: nếu phiếu gắn đơn mua thì cộng số đã nhận trên đơn trước (đơn kiểm số lượng và trạng thái),
   * rồi ghi sổ tồn. Cả hai nằm trong transaction của lớp con; lỗi bước nào thì rollback cả hai.
   */
  protected async applyReceipt(
    manager: EntityManager,
    emit: (event: ProcurementFlowEvent) => void,
    input: ProcurementFlowReceiptInput,
  ): Promise<void> {
    if (input.orderId) {
      await this.fulfilment.applyGoodsReceipt(
        manager,
        input.orderId,
        input.items,
      );
    }
    await this.stock.post(manager, input.stock);
    emit(this.receiptEvent(PROCUREMENT_FLOW_EVENTS.receiptPosted, input));
  }

  /** Hủy nhận hàng: hoàn số đã nhận trên đơn (nếu có) rồi đảo sổ tồn, cùng transaction. */
  protected async revertReceipt(
    manager: EntityManager,
    emit: (event: ProcurementFlowEvent) => void,
    input: Omit<ProcurementFlowReceiptInput, 'stock'> & {
      stock: ProcurementFlowStockDocument;
    },
  ): Promise<void> {
    if (input.orderId) {
      await this.fulfilment.revertGoodsReceipt(
        manager,
        input.orderId,
        input.items,
      );
    }
    await this.stock.reverse(manager, input.stock);
    emit(this.receiptEvent(PROCUREMENT_FLOW_EVENTS.receiptCancelled, input));
  }

  private receiptEvent(
    type: string,
    input: Pick<ProcurementFlowReceiptInput, 'orderId'> & {
      stock: ProcurementFlowStockDocument;
    },
  ): ProcurementFlowEvent {
    return {
      type,
      documentType: input.stock.documentType,
      documentId: input.stock.documentId,
      actorId: input.stock.createdBy,
      payload: { orderId: input.orderId, branchId: input.stock.branchId },
    };
  }
}
