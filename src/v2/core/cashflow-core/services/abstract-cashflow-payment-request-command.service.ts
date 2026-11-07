import { ConflictException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { ApprovalEventService } from '@/v2/core/approval-core/approval-event.service';
import type { TransitionRule } from '@/v2/core/approval-core/approval.engine';
import {
  CASHFLOW_PAYMENT_REQUEST_DOC_TYPE,
  CASHFLOW_PAYMENT_REQUEST_STATUS,
  CASHFLOW_PAYMENT_REQUEST_TRANSITIONS,
} from '../contracts/cashflow-payment-request.contract';
import type { CashflowForecastAction } from '../contracts/cashflow-core.contract';
import type { CashflowForecastHook } from '../contracts/cashflow-core.hooks';
import { CashflowPaymentRequest } from '../entities/cashflow-payment-request.entity';
import {
  AbstractCashflowForecastCommandService,
  CashflowForecastActor,
} from './abstract-cashflow-forecast-command.service';

/**
 * Command DNTT dùng chung lõi duyệt. Khác dự chi ở ba điểm: bảng chuyển trạng thái,
 * duyệt xong là APPROVED (không phải OPEN), và không cho hủy khi đã có thực chi.
 * Module con khai báo `hasEffectivePayments` (đọc từ cashflow_payments).
 */
export abstract class AbstractCashflowPaymentRequestCommandService extends AbstractCashflowForecastCommandService<CashflowPaymentRequest> {
  protected readonly headerEntity = CashflowPaymentRequest;
  protected readonly docType = CASHFLOW_PAYMENT_REQUEST_DOC_TYPE;

  constructor(
    dataSource: DataSource,
    events: ApprovalEventService,
    hooks: CashflowForecastHook<CashflowPaymentRequest>[],
  ) {
    super(dataSource, events, hooks);
  }

  /** Có thực chi hiệu lực (POSTED) nào gắn với DNTT này không. */
  protected abstract hasEffectivePayments(
    manager: EntityManager,
    requestId: string,
  ): Promise<boolean>;

  protected transitionRules(): Record<CashflowForecastAction, TransitionRule> {
    return CASHFLOW_PAYMENT_REQUEST_TRANSITIONS;
  }

  protected initialStatus(requiresApproval: boolean): string {
    return requiresApproval
      ? CASHFLOW_PAYMENT_REQUEST_STATUS.DRAFT
      : CASHFLOW_PAYMENT_REQUEST_STATUS.APPROVED;
  }

  protected async beforeTransition(
    manager: EntityManager,
    header: CashflowPaymentRequest,
    action: CashflowForecastAction,
    _actor: CashflowForecastActor,
  ): Promise<void> {
    if (action !== 'cancel') return;
    if (await this.hasEffectivePayments(manager, header.id)) {
      throw new ConflictException(
        'Đề nghị đã có thực chi, không thể hủy. Hãy hủy các thực chi trước.',
      );
    }
  }
}
