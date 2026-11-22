import { Logger } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import type {
  ProcurementFlowEvent,
  ProcurementFlowEventPort,
  SaveAndActPort,
} from '../contracts/procurement-flow-core.contract';

/** Cổng sự kiện rỗng cho orchestrator chưa phát sự kiện nội bộ (thông báo gửi sau commit ở facade). */
export const NO_PROCUREMENT_FLOW_EVENTS: ProcurementFlowEventPort = {
  publish: () => Promise.resolve(),
};

/**
 * Nền của mọi orchestrator procurement: chạy các bước trong MỘT transaction, gom sự kiện,
 * chỉ phát sự kiện sau khi commit. Lớp con khai báo `dataSource` và `events` bằng Clean DI.
 */
export abstract class AbstractTransactionalFlow {
  protected readonly logger = new Logger(this.constructor.name);
  protected abstract readonly dataSource: DataSource;
  protected abstract readonly events: ProcurementFlowEventPort;

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
   * Lưu chứng từ rồi chạy hành động trong cùng một transaction (tạo mới hoặc cập nhật nháp,
   * sau đó gửi duyệt/ghi nhận/ghi sổ). Lỗi bất kỳ bước nào rollback cả hai.
   */
  protected saveAndAct<TInput, TDoc>(
    port: SaveAndActPort<TInput, TDoc>,
    id: string | null,
    input: TInput,
  ): Promise<TDoc> {
    return this.runInTransaction(async (manager, emit) => {
      const saved = await port.save(manager, id, input);
      return port.act(manager, emit, saved.id);
    });
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
}
