import { Logger } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import type {
  ProcurementFlowEvent,
  ProcurementFlowEventPort,
  ProcurementFlowReceiptInput,
  ProcurementFlowStockDocument,
  ProcurementOrderFulfilmentPort,
  ProcurementReceiptStockPort,
} from '../contracts/procurement-flow-core.contract';
import { PROCUREMENT_FLOW_EVENTS } from '../contracts/procurement-flow-core.contract';

/**
 * Khung điều phối procurement-flow-core (abstract): chạy các bước trong MỘT transaction, gom sự kiện,
 * và chỉ phát sự kiện sau khi commit. Không có @Injectable và không đăng ký trong lõi:
 * module con kế thừa, khai báo `dataSource`, `events`, `fulfilment`, `stock` bằng Clean DI constructor
 * (một chữ ký, không overload).
 *
 * Lõi chỉ định nghĩa THỨ TỰ bước của chuỗi mua (nhận hàng vào đơn mua, ghi sổ tồn, phát sự kiện).
 * Khóa chứng từ, kiểm hợp lệ và đổi trạng thái phiếu là việc của lớp con.
 */
export abstract class AbstractProcurementFlowService {
  protected readonly logger = new Logger(this.constructor.name);
  protected abstract readonly dataSource: DataSource;
  protected abstract readonly events: ProcurementFlowEventPort;
  protected abstract readonly fulfilment: ProcurementOrderFulfilmentPort;
  protected abstract readonly stock: ProcurementReceiptStockPort;

  /**
   * Chạy `work` trong một transaction. `emit` chỉ gom sự kiện; sự kiện được phát sau commit.
   * Transaction lỗi (rollback) thì không phát sự kiện nào.
   */
  protected async runInTransaction<T>(
    work: (
      manager: EntityManager,
      emit: (event: ProcurementFlowEvent) => void,
    ) => Promise<T>,
  ): Promise<T> {
    const pending: ProcurementFlowEvent[] = [];
    const result = await this.dataSource.transaction((manager) =>
      work(manager, (event) => {
        pending.push(event);
      }),
    );
    await this.publishAfterCommit(pending);
    return result;
  }

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

  /** Phát sự kiện đã commit. Lỗi phát chỉ ghi log, không làm hỏng kết quả đã commit. */
  protected async publishAfterCommit(
    events: ProcurementFlowEvent[],
  ): Promise<void> {
    for (const event of events) {
      try {
        await this.events.publish(event);
      } catch (error) {
        this.logger.warn(
          `Không phát được sự kiện ${event.type} (${event.documentType} ${event.documentId}): ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
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
