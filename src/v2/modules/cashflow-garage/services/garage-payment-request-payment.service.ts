import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
import {
  CASHFLOW_PAYMENT_REQUEST_STATUS,
  CashflowPaymentRequest,
  CashflowPaymentRequestLine,
} from '@/v2/core/cashflow-core';
import {
  allocatePaymentToLines,
  fromCents,
  paymentRequestStatusAfter,
  PayableLine,
  toCents,
} from '@/v2/core/cashflow-core/services/cashflow-payment-request.rules';
import { GARAGE_PO_REF_TYPE } from '../contracts/garage-payment-request.types';
import {
  allocateToSourceRequest,
  syncPurchaseOrderPaymentStatus,
} from './garage-po-payment-status';

export type PaymentChannel = 'CASH' | 'BANK' | 'POS' | 'OTHER';

export interface RecordPaymentCommand {
  amount: number;
  transDate: string;
  channel?: PaymentChannel;
  note?: string | null;
}

export interface RecordPaymentResult {
  paymentId: string;
  requestStatus: string;
  allocations: Array<{ lineId: string; amount: string }>;
}

/**
 * Ghi chi và hủy chi cho đề nghị thanh toán Garage. Mọi thao tác trong một transaction:
 * khóa đề nghị -> chia tiền theo dòng -> ghi thực chi và chi tiết theo dòng
 * -> đồng bộ PO (payment_status) và phân bổ vào PR -> cập nhật trạng thái đề nghị.
 */
@Injectable()
export class GaragePaymentRequestPaymentService {
  constructor(private readonly dataSource: DataSource) {}

  async recordPayment(
    requestId: string,
    command: RecordPaymentCommand,
    actorId: string,
  ): Promise<RecordPaymentResult> {
    return this.dataSource.transaction(async (manager) => {
      const request = await lockRequest(manager, requestId);
      if (
        request.status !== CASHFLOW_PAYMENT_REQUEST_STATUS.APPROVED &&
        request.status !== CASHFLOW_PAYMENT_REQUEST_STATUS.PARTIAL
      ) {
        throw new ConflictException(
          `Chỉ chi khi đề nghị đã duyệt (hiện ${request.status})`,
        );
      }

      const lines = await manager.find(CashflowPaymentRequestLine, {
        where: { requestId },
        order: { createdAt: 'ASC', id: 'ASC' },
      });
      const paid = await paidCentsByLine(
        manager,
        lines.map((l) => l.id),
      );
      const payable: PayableLine[] = lines.map((l) => ({
        id: l.id,
        amountCents: toCents(l.amount),
        paidCents: paid.get(l.id) ?? 0,
      }));

      let allocations;
      try {
        allocations = allocatePaymentToLines(payable, toCents(command.amount));
      } catch (error) {
        throw new BadRequestException(
          error instanceof Error ? error.message : String(error),
        );
      }

      const paymentId = await insertPayment(manager, request, command, actorId);
      for (const a of allocations) {
        await manager.query(
          `INSERT INTO cashflow_payment_request_line_payments (payment_id, line_id, amount)
           VALUES ($1, $2, $3)`,
          [paymentId, a.lineId, fromCents(a.amountCents)],
        );
      }

      const lineById = new Map(lines.map((l) => [l.id, l]));
      const poShares = new Map<string, number>();
      for (const a of allocations) {
        const line = lineById.get(a.lineId);
        if (line?.refType === GARAGE_PO_REF_TYPE && line.refId) {
          poShares.set(
            line.refId,
            (poShares.get(line.refId) ?? 0) + a.amountCents,
          );
        }
      }
      for (const [poId, shareCents] of poShares) {
        await allocateToSourceRequest(
          manager,
          poId,
          paymentId,
          shareCents,
          actorId,
        );
        await syncPurchaseOrderPaymentStatus(manager, poId);
      }

      const requestStatus = await refreshRequestStatus(manager, request, lines);
      return {
        paymentId,
        requestStatus,
        allocations: allocations.map((a) => ({
          lineId: a.lineId,
          amount: fromCents(a.amountCents),
        })),
      };
    });
  }

  /** Hủy một lần chi: thực chi chuyển CANCELLED, bỏ phân bổ PR, tính lại đơn mua và đề nghị. */
  async voidPayment(
    paymentId: string,
    reason: string,
  ): Promise<{ requestStatus: string }> {
    const clean = (reason ?? '').trim();
    if (!clean) throw new BadRequestException('Cần lý do hủy thực chi');

    return this.dataSource.transaction(async (manager) => {
      const [payment] = await manager.query(
        `SELECT id, status, payment_request_id FROM cashflow_payments WHERE id = $1 FOR UPDATE`,
        [paymentId],
      );
      if (!payment?.payment_request_id) {
        throw new NotFoundException('Không tìm thấy thực chi của đề nghị');
      }
      if (payment.status !== 'POSTED') {
        throw new ConflictException('Thực chi này đã bị hủy');
      }
      const request = await lockRequest(manager, payment.payment_request_id);
      const lines = await manager.find(CashflowPaymentRequestLine, {
        where: { requestId: request.id },
        order: { createdAt: 'ASC', id: 'ASC' },
      });

      const affected: Array<{ ref_id: string }> = await manager.query(
        `SELECT DISTINCT l.ref_id
           FROM cashflow_payment_request_line_payments lp
           JOIN cashflow_payment_request_lines l ON l.id = lp.line_id
          WHERE lp.payment_id = $1 AND l.ref_type = 'GARAGE_PO' AND l.ref_id IS NOT NULL`,
        [paymentId],
      );

      await manager.query(
        `UPDATE cashflow_payments
            SET status = 'CANCELLED',
                note = concat_ws(' | ', note, $2::text),
                updated_at = now()
          WHERE id = $1`,
        [paymentId, `Hủy thực chi: ${clean}`],
      );
      await manager.query(
        `DELETE FROM cashflow_allocations WHERE payment_id = $1`,
        [paymentId],
      );

      for (const row of affected) {
        await syncPurchaseOrderPaymentStatus(manager, row.ref_id);
      }
      const requestStatus = await refreshRequestStatus(manager, request, lines);
      return { requestStatus };
    });
  }
}

async function lockRequest(
  manager: EntityManager,
  requestId: string,
): Promise<CashflowPaymentRequest> {
  const request = await manager
    .createQueryBuilder(CashflowPaymentRequest, 'r')
    .setLock('pessimistic_write')
    .where('r.id = :id', { id: requestId })
    .andWhere('r.isDeleted = :deleted', { deleted: false })
    .getOne();
  if (!request)
    throw new NotFoundException('Không tìm thấy đề nghị thanh toán');
  return request;
}

/** Tổng đã chi (xu) theo từng dòng, chỉ tính thực chi POSTED. */
async function paidCentsByLine(
  manager: EntityManager,
  lineIds: string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (lineIds.length === 0) return out;
  const rows: Array<{ line_id: string; s: string }> = await manager.query(
    `SELECT lp.line_id, sum(lp.amount)::text AS s
       FROM cashflow_payment_request_line_payments lp
       JOIN cashflow_payments p ON p.id = lp.payment_id
      WHERE lp.line_id = ANY($1::uuid[]) AND p.status = 'POSTED'
      GROUP BY lp.line_id`,
    [lineIds],
  );
  for (const row of rows) out.set(row.line_id, toCents(row.s));
  return out;
}

async function insertPayment(
  manager: EntityManager,
  request: CashflowPaymentRequest,
  command: RecordPaymentCommand,
  actorId: string,
): Promise<string> {
  const [row] = await manager.query(
    `INSERT INTO cashflow_payments
       (code, direction, amount, trans_date, channel, payment_request_id,
        partner_name, branch_id, status, note, created_by)
     VALUES ($1, 'OUT', $2, $3, $4, $5, $6, $7, 'POSTED', $8, $9)
     RETURNING id`,
    [
      `TT-DNTT-${randomUUID()}`,
      fromCents(toCents(command.amount)),
      command.transDate,
      command.channel ?? 'OTHER',
      request.id,
      request.partnerName,
      request.branchId,
      command.note ?? null,
      actorId,
    ],
  );
  return row.id as string;
}

/** Tính lại trạng thái đề nghị theo tổng đã chi. */
async function refreshRequestStatus(
  manager: EntityManager,
  request: CashflowPaymentRequest,
  lines: CashflowPaymentRequestLine[],
): Promise<string> {
  const totalCents = lines.reduce((s, l) => s + toCents(l.amount), 0);
  const paid = await paidCentsByLine(
    manager,
    lines.map((l) => l.id),
  );
  const paidCents = [...paid.values()].reduce((s, v) => s + v, 0);
  const next = paymentRequestStatusAfter(totalCents, paidCents, request.status);
  if (next !== request.status) {
    request.status = next;
    await manager.save(request);
  }
  return next;
}
