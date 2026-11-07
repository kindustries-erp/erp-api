import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { GarageProcurementOrder } from '@/v2/modules/procurement-orders-garage/entities/procurement-order.entity';
import {
  fromCents,
  remainingCapacityCents,
  toCents,
} from '@/v2/core/cashflow-core/services/cashflow-payment-request.rules';
import { GaragePaymentRequestLineInput } from '../contracts/garage-payment-request.types';

/** Trạng thái DNTT không còn tính vào trần của đơn mua. */
const INACTIVE_REQUEST_STATUSES = ['CANCELLED', 'REJECTED'];

export interface ValidatedPaymentRequestLines {
  totalCents: number;
  supplierId: string | null;
  supplierName: string | null;
  lines: Array<{ poId: string; amountCents: number }>;
}

/**
 * Kiểm tra dòng DNTT trong transaction đang chạy:
 * - Đơn mua tồn tại, chưa xóa, trạng thái ISSUED; khóa dòng đơn mua để hai DNTT song song không vượt trần.
 * - Mọi dòng cùng nhà cung cấp; không trùng đơn mua; số tiền > 0.
 * - Tổng các dòng đang hiệu lực của đơn mua (trừ DNTT `excludeRequestId`) + dòng mới ≤ approved_total (hoặc total_amount).
 */
export async function validatePaymentRequestLines(
  manager: EntityManager,
  lines: GaragePaymentRequestLineInput[],
  excludeRequestId: string | null = null,
): Promise<ValidatedPaymentRequestLines> {
  if (!lines || lines.length === 0) {
    throw new BadRequestException('Đề nghị thanh toán cần ít nhất một dòng');
  }
  const poIds = lines.map((l) => l.poId);
  if (new Set(poIds).size !== poIds.length) {
    throw new BadRequestException(
      'Mỗi đơn mua chỉ được xuất hiện một lần trong đề nghị',
    );
  }
  for (const line of lines) {
    if (!(Number(line.amount) > 0)) {
      throw new BadRequestException('Số tiền từng dòng phải lớn hơn 0');
    }
  }

  const pos = await manager
    .createQueryBuilder(GarageProcurementOrder, 'o')
    .setLock('pessimistic_write')
    .where('o.id IN (:...ids)', { ids: poIds })
    .andWhere('o.isDeleted = :deleted', { deleted: false })
    .getMany();
  const byId = new Map(pos.map((p) => [p.id, p]));

  let supplierKey: string | null = null;
  let supplierId: string | null = null;
  let supplierName: string | null = null;
  const out: ValidatedPaymentRequestLines = {
    totalCents: 0,
    supplierId: null,
    supplierName: null,
    lines: [],
  };

  for (const line of lines) {
    const po = byId.get(line.poId);
    if (!po) throw new NotFoundException(`Không tìm thấy đơn mua ${line.poId}`);
    if (po.status !== 'ISSUED') {
      throw new ConflictException(
        `Đơn mua ${po.orderNo} đang ${po.status}, chỉ đề nghị chi được đơn đã phát hành (ISSUED)`,
      );
    }
    const key = po.supplierId
      ? `id:${po.supplierId}`
      : `name:${po.supplierName ?? ''}`;
    if (supplierKey === null) {
      supplierKey = key;
      supplierId = po.supplierId ?? null;
      supplierName = po.supplierName ?? null;
    } else if (supplierKey !== key) {
      throw new BadRequestException('Các dòng đề nghị phải cùng nhà cung cấp');
    }

    const capCents = toCents(po.approvedTotal ?? po.totalAmount);
    const active = await manager.query(
      `SELECT coalesce(sum(l.amount), 0)::text AS s
         FROM cashflow_payment_request_lines l
         JOIN cashflow_payment_requests r ON r.id = l.request_id
        WHERE l.ref_type = 'GARAGE_PO' AND l.ref_id = $1
          AND r.is_deleted = false
          AND NOT (r.status = ANY($2::text[]))
          AND ($3::uuid IS NULL OR r.id <> $3::uuid)`,
      [po.id, INACTIVE_REQUEST_STATUSES, excludeRequestId],
    );
    const activeCents = toCents(active[0].s);
    const room = remainingCapacityCents(capCents, activeCents);
    const amountCents = toCents(line.amount);
    if (amountCents > room) {
      throw new BadRequestException(
        `Đơn mua ${po.orderNo} còn có thể đề nghị ${fromCents(room)}, không đủ cho ${fromCents(amountCents)}`,
      );
    }
    out.lines.push({ poId: po.id, amountCents });
    out.totalCents += amountCents;
  }

  out.supplierId = supplierId;
  out.supplierName = supplierName;
  return out;
}
