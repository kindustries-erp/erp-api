import { NotFoundException } from '@nestjs/common';
import { DataSource, DeepPartial, EntityManager, EntityTarget } from 'typeorm';
import { ApprovalEventService } from '@/v2/core/approval-core/approval-event.service';
import { resolveTransition } from '@/v2/core/approval-core/approval.engine';
import {
  STOCK_VOUCHER_TRANSITIONS,
  StockVoucherAction,
} from '../contracts/inventory-movements-core.contract';
import { BaseStockVoucherEntity } from '../entities/base-stock-voucher.entity';

export interface StockVoucherActor {
  id: string;
  roles: string[];
}

/**
 * Command trừu tượng họ inventory-movements-core. Mọi chuyển trạng thái chạy trong một transaction:
 * khóa header, kiểm tra chuyển trạng thái, cập nhật, rồi ghi nhật ký cùng lúc.
 * Nghiệp vụ riêng của module viết ở các hook CUSTOM (beforeTransition, applyFields, initialStatus).
 */
export abstract class AbstractStockVoucherCommandService<
  H extends BaseStockVoucherEntity = BaseStockVoucherEntity,
> {
  protected abstract readonly headerEntity: EntityTarget<H>;
  /** Mã loại chứng từ ghi vào nhật ký, ví dụ: SAMPLE_ORDER. */
  protected abstract readonly docType: string;

  constructor(
    protected readonly dataSource: DataSource,
    protected readonly events: ApprovalEventService,
  ) {}

  /** CUSTOM: trạng thái ban đầu của chứng từ mới. Mặc định DRAFT. */
  protected get initialStatus(): string {
    return 'DRAFT';
  }

  /** Tạo chứng từ ở trạng thái ban đầu. Dữ liệu đầu vào đã được DTO kiểm tra ở controller. */
  async createDraft(actor: StockVoucherActor, data: object): Promise<H> {
    return this.dataSource.transaction(async (manager) => {
      const entity = manager.create(this.headerEntity, {
        ...data,
        status: this.initialStatus,
        createdBy: actor.id,
        isDeleted: false,
      } as DeepPartial<H>);
      return manager.save(this.headerEntity, entity);
    });
  }

  async transition(
    id: string,
    action: StockVoucherAction,
    actor: StockVoucherActor,
    reason?: string | null,
  ): Promise<H> {
    return this.dataSource.transaction(async (manager) => {
      const header = await this.lockHeader(manager, id);
      const from = header.status;
      const cleanReason = reason?.trim() || null;

      // Kiểm tra trạng thái TRƯỚC khi chạy hook: hook có thể cộng/trừ tồn, không được chạy cho hành động sai trạng thái.
      const to = resolveTransition(STOCK_VOUCHER_TRANSITIONS, from, action);
      await this.beforeTransition(manager, header, action, actor, cleanReason);
      this.applyFields(header, action, actor, cleanReason);
      header.status = to;
      await manager.save(this.headerEntity, header);

      await this.events.record(manager, {
        docType: this.docType,
        docId: id,
        action,
        fromStatus: from,
        toStatus: to,
        actorId: actor.id,
        actorRoles: actor.roles,
        comment: cleanReason,
      });
      return header;
    });
  }

  /** Khóa pessimistic_write trên header để tránh hai thao tác đồng thời cùng chuyển trạng thái. */
  protected async lockHeader(manager: EntityManager, id: string): Promise<H> {
    const header = await manager
      .createQueryBuilder(this.headerEntity, 'h')
      .setLock('pessimistic_write')
      .where('h.id = :id', { id })
      .andWhere('h.isDeleted = :deleted', { deleted: false })
      .getOne();
    if (!header) {
      throw new NotFoundException(`Không tìm thấy chứng từ ${id}`);
    }
    return header;
  }

  /** CUSTOM: kiểm tra điều kiện riêng trước khi chuyển trạng thái. Ném lỗi để chặn. Mặc định không làm gì. */
  protected beforeTransition(
    _manager: EntityManager,
    _header: H,
    _action: StockVoucherAction,
    _actor: StockVoucherActor,
    _reason: string | null,
  ): Promise<void> | void {
    // Mặc định không kiểm tra thêm.
  }

  /** CUSTOM: cập nhật trường phụ (ví dụ thời điểm duyệt, người duyệt) trước khi lưu. Mặc định không làm gì. */
  protected applyFields(
    _header: H,
    _action: StockVoucherAction,
    _actor: StockVoucherActor,
    _reason: string | null,
  ): void {
    // Mặc định không cập nhật trường nào thêm.
  }
}
