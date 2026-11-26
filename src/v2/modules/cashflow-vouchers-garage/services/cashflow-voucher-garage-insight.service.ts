import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

import { applyBranchScope } from '@/v2/core/branches-core';
import {
  normalizePlate,
  normalizedPlateSql,
} from '@/common/utils/license-plate';
import { toMoney } from '@/v2/core/debts-core';
import type {
  CashflowDashboardGarage,
  CashflowDuplicateGroup,
  CashflowDuplicateResult,
} from '../dto/cashflow-voucher-garage.types';
import type { CheckCashflowDuplicateGarageDto } from '../dto/query-cashflow-voucher-garage.dto';
import { CashflowVoucherGarage } from '../entities/cashflow-voucher-garage.entity';

const NEARBY_DAYS = 7;
const MAX_ITEMS = 5;
const PENDING_STATUSES = ['EXPECTED', 'PENDING', 'APPROVED'];
const EMPTY: CashflowDuplicateGroup = { items: [], total: 0 };

export function shiftDate(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Số tổng của kỳ và cảnh báo trùng phiếu. Mọi truy vấn cách ly theo chi nhánh, bỏ phiếu đã hủy/xóa. */
@Injectable()
export class CashflowVoucherGarageInsightService {
  constructor(
    @InjectRepository(CashflowVoucherGarage)
    private readonly vouchers: Repository<CashflowVoucherGarage>,
  ) {}

  async getDashboard(
    branchId: string | undefined,
    range: { from?: string; to?: string },
  ): Promise<CashflowDashboardGarage> {
    const qb = this.vouchers
      .createQueryBuilder('v')
      .select(
        `COALESCE(SUM(CASE WHEN v.voucher_type = 'RECEIPT' AND v.status = 'PAID' THEN v.amount END), 0)`,
        'receipt_paid',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN v.voucher_type = 'PAYMENT' AND v.status = 'PAID' THEN v.amount END), 0)`,
        'payment_paid',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN v.voucher_type = 'RECEIPT' AND v.status IN (:...pending) THEN v.amount END), 0)`,
        'receipt_expected',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN v.voucher_type = 'PAYMENT' AND v.status IN (:...pending) THEN v.amount END), 0)`,
        'payment_expected',
      )
      .addSelect('COUNT(*)', 'voucher_count')
      .where('v.is_deleted = false')
      .andWhere("v.status <> 'CANCELLED'")
      .setParameter('pending', PENDING_STATUSES);
    applyBranchScope(qb, 'v', branchId);
    if (range.from) qb.andWhere('v.trans_date >= :from', { from: range.from });
    if (range.to) qb.andWhere('v.trans_date <= :to', { to: range.to });
    const raw = (await qb.getRawOne<Record<string, string>>()) ?? {};
    const receiptPaid = toMoney(raw.receipt_paid);
    const paymentPaid = toMoney(raw.payment_paid);
    return {
      receiptPaid,
      paymentPaid,
      netPaid: toMoney(receiptPaid - paymentPaid),
      receiptExpected: toMoney(raw.receipt_expected),
      paymentExpected: toMoney(raw.payment_expected),
      voucherCount: Number(raw.voucher_count ?? 0),
    };
  }

  async findPotentialDuplicates(
    branchId: string | undefined,
    q: CheckCashflowDuplicateGarageDto,
  ): Promise<CashflowDuplicateResult> {
    const base = () => {
      const qb = this.vouchers
        .createQueryBuilder('v')
        .leftJoin('kgara_cases', 'c', 'c.id = v.case_id')
        .select([
          'v.id AS id',
          'v.voucher_code AS voucher_code',
          'v.voucher_type AS voucher_type',
          'v.amount AS amount',
          'v.trans_date AS trans_date',
          'v.license_plate AS license_plate',
          'c.so_chung_tu AS case_code',
          'v.partner_name AS partner_name',
        ])
        .where('v.is_deleted = false')
        .andWhere("v.status <> 'CANCELLED'")
        .andWhere('v.amount = :amount', { amount: q.amount });
      applyBranchScope(qb, 'v', branchId);
      if (q.excludeId)
        qb.andWhere('v.id <> :excludeId', { excludeId: q.excludeId });
      return qb;
    };
    const run = async (
      qb: ReturnType<typeof base>,
    ): Promise<CashflowDuplicateGroup> => {
      const ordered = qb
        .orderBy('v.trans_date', 'DESC')
        .addOrderBy('v.created_at', 'DESC');
      const total = await ordered.clone().getCount();
      const rows = await ordered
        .limit(MAX_ITEMS)
        .getRawMany<Record<string, string>>();
      return {
        total,
        items: rows.map((r) => ({
          id: r.id,
          voucherCode: r.voucher_code,
          voucherType: r.voucher_type,
          amount: toMoney(r.amount),
          transDate: r.trans_date,
          licensePlate: r.license_plate ?? null,
          caseCode: r.case_code ?? null,
          partnerName: r.partner_name ?? null,
        })),
      };
    };

    const center = q.transDate || new Date().toISOString().slice(0, 10);
    const plate = normalizePlate(q.licensePlate);
    const [nearbyDate, sameCase, samePlate] = await Promise.all([
      run(
        base().andWhere('v.trans_date BETWEEN :from AND :to', {
          from: shiftDate(center, -NEARBY_DAYS),
          to: shiftDate(center, NEARBY_DAYS),
        }),
      ),
      q.caseId
        ? run(base().andWhere('v.case_id = :caseId', { caseId: q.caseId }))
        : EMPTY,
      plate
        ? run(
            base().andWhere(
              `${normalizedPlateSql('v.license_plate')} = :plate`,
              { plate },
            ),
          )
        : EMPTY,
    ]);
    return { nearbyDate, sameCase, samePlate };
  }
}
