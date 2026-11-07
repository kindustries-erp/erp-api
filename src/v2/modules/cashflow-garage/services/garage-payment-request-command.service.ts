import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomInt } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
import { ApprovalEventService } from '@/v2/core/approval-core/approval-event.service';
import {
  AbstractCashflowPaymentRequestCommandService,
  CASHFLOW_PAYMENT_REQUEST_STATUS,
  CashflowForecastActor,
  CashflowForecastHook,
  CashflowPaymentRequest,
  CashflowPaymentRequestLine,
  DEFAULT_PAYMENT_REQUEST_APPROVAL_ENABLED,
} from '@/v2/core/cashflow-core';
import { fromCents } from '@/v2/core/cashflow-core/services/cashflow-payment-request.rules';
import {
  GARAGE_PAYMENT_REQUEST_HOOKS,
  GARAGE_PO_REF_TYPE,
  GaragePaymentRequestLineInput,
} from '../contracts/garage-payment-request.types';
import { validatePaymentRequestLines } from './garage-payment-request-lines.validator';

export interface CreateGaragePaymentRequestCommand {
  lines: GaragePaymentRequestLineInput[];
  partnerName?: string | null;
  branchId?: string | null;
  note?: string | null;
  requiresApproval?: boolean;
}

/** Mã DNTT: DNTT-GARA-yymmdd-nnnnnn. Ràng buộc unique của cột code chặn trùng khi tạo đồng thời. */
function newRequestCode(now: Date = new Date()): string {
  const ymd = [
    String(now.getFullYear()).slice(2),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('');
  return `DNTT-GARA-${ymd}-${String(randomInt(0, 1000000)).padStart(6, '0')}`;
}

/**
 * Command DNTT Garage. Ghi dòng và tổng tiền trong cùng transaction tạo header (qua hook).
 * Sửa dòng chỉ khi còn DRAFT. Hủy bị chặn khi đã có thực chi (ở lõi).
 */
@Injectable()
export class GaragePaymentRequestCommandService extends AbstractCashflowPaymentRequestCommandService {
  constructor(
    dataSource: DataSource,
    events: ApprovalEventService,
    @Inject(GARAGE_PAYMENT_REQUEST_HOOKS)
    hooks: CashflowForecastHook<CashflowPaymentRequest>[],
  ) {
    super(dataSource, events, hooks);
  }

  protected async hasEffectivePayments(
    manager: EntityManager,
    requestId: string,
  ): Promise<boolean> {
    const rows = await manager.query(
      `SELECT 1
         FROM cashflow_payment_request_line_payments lp
         JOIN cashflow_payment_request_lines l ON l.id = lp.line_id
         JOIN cashflow_payments p ON p.id = lp.payment_id
        WHERE l.request_id = $1 AND p.status = 'POSTED'
        LIMIT 1`,
      [requestId],
    );
    return rows.length > 0;
  }

  /** Tạo DNTT nháp (hoặc đã duyệt nếu cấu hình không cần duyệt). */
  async createRequest(
    actor: CashflowForecastActor,
    command: CreateGaragePaymentRequestCommand,
  ): Promise<CashflowPaymentRequest> {
    if (!command.lines || command.lines.length === 0) {
      throw new BadRequestException('Đề nghị thanh toán cần ít nhất một dòng');
    }
    return this.createDraft(
      actor,
      {
        code: newRequestCode(),
        amount: '0.00',
        partnerName: command.partnerName ?? null,
        branchId: command.branchId ?? null,
        note: command.note ?? null,
        isDeleted: false,
        requiresApproval:
          command.requiresApproval ?? DEFAULT_PAYMENT_REQUEST_APPROVAL_ENABLED,
      },
      { lines: command.lines },
    );
  }

  /** Thay toàn bộ dòng khi còn DRAFT. */
  async replaceLines(
    requestId: string,
    lines: GaragePaymentRequestLineInput[],
  ): Promise<CashflowPaymentRequest> {
    return this.dataSource.transaction(async (manager) => {
      const header = await manager
        .createQueryBuilder(CashflowPaymentRequest, 'r')
        .setLock('pessimistic_write')
        .where('r.id = :id', { id: requestId })
        .andWhere('r.isDeleted = :deleted', { deleted: false })
        .getOne();
      if (!header) {
        throw new NotFoundException('Không tìm thấy đề nghị thanh toán');
      }
      if (header.status !== CASHFLOW_PAYMENT_REQUEST_STATUS.DRAFT) {
        throw new ConflictException(
          `Chỉ sửa dòng khi đề nghị còn DRAFT (hiện ${header.status})`,
        );
      }
      const validated = await validatePaymentRequestLines(
        manager,
        lines,
        requestId,
      );
      await manager.delete(CashflowPaymentRequestLine, { requestId });
      await manager.save(
        manager.create(
          CashflowPaymentRequestLine,
          validated.lines.map((line) => ({
            requestId,
            forecastId: null,
            refType: GARAGE_PO_REF_TYPE,
            refId: line.poId,
            amount: fromCents(line.amountCents),
          })),
        ),
      );
      header.amount = fromCents(validated.totalCents);
      header.supplierId = validated.supplierId;
      await manager.save(header);
      return header;
    });
  }
}
