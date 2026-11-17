import { Logger } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import type {
  DebtFlowEvent,
  DebtFlowEventPort,
} from '../contracts/debts-core.contract';

/**
 * Khung điều phối debts-core (abstract): chạy các bước trong MỘT transaction, gom sự kiện,
 * và chỉ phát sự kiện sau khi commit. Không có @Injectable và không đăng ký trong lõi:
 * module con kế thừa, khai báo `dataSource` và `events` bằng Clean DI constructor (một chữ ký, không overload).
 *
 * Nghiệp vụ riêng (thứ tự bước, cổng cụ thể) điền ở lớp con, tại các hàm gọi `runInTransaction`.
 */
export abstract class AbstractDebtFlowService {
  protected readonly logger = new Logger(this.constructor.name);
  protected abstract readonly dataSource: DataSource;
  protected abstract readonly events: DebtFlowEventPort;

  /**
   * Chạy `work` trong một transaction. `emit` chỉ gom sự kiện; sự kiện được phát sau commit.
   * Transaction lỗi (rollback) thì không phát sự kiện nào.
   */
  protected async runInTransaction<T>(
    work: (
      manager: EntityManager,
      emit: (event: DebtFlowEvent) => void,
    ) => Promise<T>,
  ): Promise<T> {
    const pending: DebtFlowEvent[] = [];
    const result = await this.dataSource.transaction((manager) =>
      work(manager, (event) => {
        pending.push(event);
      }),
    );
    await this.publishAfterCommit(pending);
    return result;
  }

  /** Phát sự kiện đã commit. Lỗi phát chỉ ghi log, không làm hỏng kết quả đã commit. */
  protected async publishAfterCommit(events: DebtFlowEvent[]): Promise<void> {
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
