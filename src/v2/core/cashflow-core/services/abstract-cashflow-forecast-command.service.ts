import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, DeepPartial, EntityManager, EntityTarget } from 'typeorm';
import { ApprovalEventService } from '@/v2/core/approval-core/approval-event.service';
import {
  assertNotSelfApproval,
  requireReason,
  resolveTransition,
} from '@/v2/core/approval-core/approval.engine';
import {
  CASHFLOW_FORECAST_ACTIONS_REQUIRING_REASON,
  CASHFLOW_FORECAST_STATUS,
  CASHFLOW_FORECAST_TRANSITIONS,
  CashflowForecastAction,
} from '../contracts/cashflow-core.contract';
import type { CashflowForecastHook } from '../contracts/cashflow-core.hooks';
import { BaseCashflowForecastEntity } from '../entities/base-cashflow-forecast.entity';

export interface CashflowForecastActor {
  id: string;
  roles: string[];
}

export interface CashflowForecastTransitionOptions {
  /** Chỉ dùng khi `submit`: người duyệt được chọn. Bắt buộc nếu chứng từ cần duyệt. */
  approverId?: string | null;
}

/**
 * Command trừu tượng của dự thu / dự chi. Mọi chuyển trạng thái chạy trong một transaction:
 * khóa dòng, kiểm tra quy tắc duyệt, chuyển trạng thái, rồi ghi nhật ký cùng transaction.
 * Nghiệp vụ riêng của module viết ở các hook CUSTOM.
 */
export abstract class AbstractCashflowForecastCommandService<
  H extends BaseCashflowForecastEntity = BaseCashflowForecastEntity,
> {
  protected abstract readonly headerEntity: EntityTarget<H>;
  /** Mã loại chứng từ ghi vào nhật ký duyệt. */
  protected abstract readonly docType: string;

  constructor(
    protected readonly dataSource: DataSource,
    protected readonly events: ApprovalEventService,
    protected readonly hooks: CashflowForecastHook<H>[],
  ) {}

  /**
   * Tạo dự thu / dự chi. Cờ `requiresApproval` do caller quyết định theo cấu hình và được chép vào dòng.
   * Không cần duyệt: trạng thái ban đầu là OPEN. Cần duyệt: DRAFT.
   */
  async createDraft(
    actor: CashflowForecastActor,
    data: Record<string, unknown> & { requiresApproval: boolean },
    input?: unknown,
  ): Promise<H> {
    return this.dataSource.transaction(async (manager) => {
      const entity = manager.create(this.headerEntity, {
        ...data,
        status: data.requiresApproval
          ? CASHFLOW_FORECAST_STATUS.DRAFT
          : CASHFLOW_FORECAST_STATUS.OPEN,
        createdBy: actor.id,
        isDeleted: false,
      } as DeepPartial<H>);
      const saved = await manager.save(this.headerEntity, entity);
      for (const hook of this.hooks) {
        await hook.afterCreate?.({ manager, header: saved, actor, input });
      }
      return saved;
    });
  }

  async transition(
    id: string,
    action: CashflowForecastAction,
    actor: CashflowForecastActor,
    reason?: string | null,
    options: CashflowForecastTransitionOptions = {},
  ): Promise<H> {
    return this.dataSource.transaction(async (manager) => {
      const header = await this.lockHeader(manager, id);
      const from = header.status;
      const cleanReason = this.checkReason(action, reason);

      await this.beforeTransition(manager, header, action, actor, cleanReason);
      const to = resolveTransition(CASHFLOW_FORECAST_TRANSITIONS, from, action);
      if (action === 'submit') {
        this.assignApprover(header, actor, options.approverId);
      }
      this.checkApprovalRules(header, action, actor);
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
      for (const hook of this.hooks) {
        await hook.afterTransition?.({
          manager,
          header,
          actor,
          action,
          from,
          to,
        });
      }
      return header;
    });
  }

  /** Khóa pessimistic_write trên dòng để tránh hai thao tác đồng thời cùng chuyển trạng thái. */
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

  /** Hành động bắt buộc có lý do thì kiểm tra và trả về lý do đã cắt khoảng trắng. */
  protected checkReason(
    action: CashflowForecastAction,
    reason: string | null | undefined,
  ): string | null {
    if (CASHFLOW_FORECAST_ACTIONS_REQUIRING_REASON.includes(action)) {
      return requireReason(reason);
    }
    return reason?.trim() || null;
  }

  /**
   * Gửi duyệt: chứng từ cần duyệt bắt buộc có người duyệt khác người gửi.
   * Chứng từ không cần duyệt không lưu người duyệt.
   */
  protected assignApprover(
    header: H,
    actor: CashflowForecastActor,
    approverId: string | null | undefined,
  ): void {
    if (!header.requiresApproval) {
      header.approverId = null;
      return;
    }
    if (!approverId) {
      throw new BadRequestException('Bắt buộc chọn người duyệt');
    }
    if (approverId === actor.id) {
      throw new BadRequestException(
        'Không được chọn chính mình làm người duyệt',
      );
    }
    header.approverId = approverId;
  }

  /**
   * Quy tắc duyệt của lõi:
   * - Người duyệt không được là người tạo.
   * - Nếu đã chỉ định người duyệt thì chỉ người đó được duyệt hoặc từ chối.
   */
  protected checkApprovalRules(
    header: H,
    action: CashflowForecastAction,
    actor: CashflowForecastActor,
  ): void {
    if (action !== 'approve' && action !== 'reject') return;
    assertNotSelfApproval(actor.id, header.createdBy);
    if (header.approverId && header.approverId !== actor.id) {
      throw new ForbiddenException(
        'Chỉ người duyệt được chỉ định mới được duyệt hoặc từ chối',
      );
    }
  }

  /** CUSTOM: kiểm tra điều kiện riêng của module trước khi chuyển trạng thái (ví dụ: chặn hủy khi đã có phân bổ). Ném lỗi để chặn. */
  protected beforeTransition(
    _manager: EntityManager,
    _header: H,
    _action: CashflowForecastAction,
    _actor: CashflowForecastActor,
    _reason: string | null,
  ): Promise<void> | void {
    // Mặc định không kiểm tra thêm.
  }

  /** Cập nhật cột duyệt theo hành động, trước khi lưu. */
  protected applyFields(
    header: H,
    action: CashflowForecastAction,
    actor: CashflowForecastActor,
    reason: string | null,
  ): void {
    const now = new Date();
    switch (action) {
      case 'submit':
        header.submittedBy = actor.id;
        header.submittedAt = now;
        header.rejectReason = null;
        break;
      case 'recall':
        header.submittedBy = null;
        header.submittedAt = null;
        break;
      case 'approve':
        header.approvedBy = actor.id;
        header.approvedAt = now;
        break;
      case 'reject':
        header.rejectedBy = actor.id;
        header.rejectedAt = now;
        header.rejectReason = reason;
        break;
      case 'cancel':
        break;
    }
  }
}
