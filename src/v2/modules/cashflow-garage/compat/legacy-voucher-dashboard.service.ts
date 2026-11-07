import { Injectable } from '@nestjs/common';
import { DataSource, SelectQueryBuilder } from 'typeorm';
import { KgaraBranch } from '@/kgara-api-core/entities/kgara_branch.entity';
import { KgaraCase } from '@/kgara-api-core/entities/kgara_case.entity';
import type {
  GarageCashflowDashboardQueryDto,
  GarageCashflowDashboardResponseDto,
  GarageCashflowKpiDto,
  GarageCashflowMethodBreakdownDto,
  GarageCashflowContentBreakdownDto,
  GarageCashflowTrendItemDto,
  GarageCashflowTopTransactionsDto,
} from '@/kgara-api-core/dto/garage-cashflow.dto';
import { CashflowForecast } from '@/v2/core/cashflow-core';
import { CashflowGarageForecastExt } from '../entities/cashflow-garage-forecast-ext.entity';
import {
  ACTUAL_IN_SQL,
  ACTUAL_OUT_SQL,
  PAYMENT_STATUS_SQL,
  PENDING_IN_SQL,
  PLANNED_OUT_SQL,
} from './legacy-voucher-sql';

type Qb = SelectQueryBuilder<CashflowForecast>;
type LegacyTopRow = {
  id: string;
  voucherCode: string | null;
  transDate: string | null;
  amount: string | number | null;
  partnerName: string | null;
  licensePlate: string | null;
  paymentMethod: string | null;
  paymentContent: string | null;
  paymentStatus: string | null;
  caseCode: string | null;
  caseId: string | null;
};
type LegacyPaymentStatus = NonNullable<
  GarageCashflowTopTransactionsDto['in'][number]['paymentStatus']
>;

/**
 * Dashboard thu chi garage theo hình dạng cũ (port từ GarageCashflowDashboardEngine).
 * Nguồn: dự thu/dự chi mới. Thực thu/chi = đã SETTLED; dự thu/dự chi = chưa SETTLED và chưa CANCELLED.
 * Lọc chi nhánh đi qua phiếu dịch vụ (kgara_cases.branch_external_id), như bản cũ.
 * Xóa cùng đợt với route cũ (P6).
 */
@Injectable()
export class LegacyVoucherDashboardService {
  constructor(private readonly dataSource: DataSource) {}

  async getDashboardStats(
    query: GarageCashflowDashboardQueryDto = {},
  ): Promise<GarageCashflowDashboardResponseDto> {
    const [kpi, methodBreakdown, contentBreakdown, trend, topTransactions] =
      await Promise.all([
        this.getKpis(query),
        this.getMethodBreakdown(query),
        this.getContentBreakdown(query),
        this.getTrend(query),
        this.getTopTransactions(query),
      ]);
    return { kpi, methodBreakdown, contentBreakdown, trend, topTransactions };
  }

  /** Query gốc với join đầy đủ và điều kiện nền (không xóa, không phải đề nghị mua cũ). */
  private baseQb(): Qb {
    return this.dataSource
      .getRepository(CashflowForecast)
      .createQueryBuilder('f')
      .innerJoin(CashflowGarageForecastExt, 'ext', 'ext.forecastId = f.id')
      .leftJoin(KgaraCase, 'kc', 'kc.id = ext.caseId')
      .where('f.isDeleted = :deleted', { deleted: false })
      .andWhere("(f.sourceType IS NULL OR f.sourceType <> 'LEGACY_PR')");
  }

  private applyBaseFilters(
    qb: Qb,
    query: GarageCashflowDashboardQueryDto,
  ): void {
    if (query.dateFrom) {
      qb.andWhere('f.plannedDate >= :dateFrom', { dateFrom: query.dateFrom });
    }
    if (query.dateTo) {
      qb.andWhere('f.plannedDate <= :dateTo', { dateTo: query.dateTo });
    }
    if (query.paymentMethod && query.paymentMethod !== 'ALL') {
      qb.andWhere('ext.legacyPaymentMethod = :paymentMethod', {
        paymentMethod: query.paymentMethod,
      });
    }
    if (query.paymentContent && query.paymentContent !== 'ALL') {
      qb.andWhere('ext.paymentContent = :paymentContent', {
        paymentContent: query.paymentContent,
      });
    }
    const branchId = query.branchId?.trim();
    if (branchId && branchId !== 'ALL') {
      qb.leftJoin(KgaraBranch, 'b', 'b.external_id = kc.branch_external_id');
      qb.andWhere(
        '(kc.branch_external_id = :branchId OR CAST(b.id AS TEXT) = :branchId OR b.name = :branchId OR b.code = :branchId)',
        { branchId },
      );
    }
  }

  private async getKpis(
    query: GarageCashflowDashboardQueryDto,
  ): Promise<GarageCashflowKpiDto> {
    const qb = this.baseQb();
    this.applyBaseFilters(qb, query);
    const raw = await qb
      .select(
        `COALESCE(SUM(CASE WHEN ${ACTUAL_IN_SQL} THEN f.amount ELSE 0 END), 0)`,
        'totalIn',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN ${ACTUAL_OUT_SQL} THEN f.amount ELSE 0 END), 0)`,
        'totalOut',
      )
      .addSelect(`COUNT(CASE WHEN ${ACTUAL_IN_SQL} THEN 1 END)`, 'countIn')
      .addSelect(`COUNT(CASE WHEN ${ACTUAL_OUT_SQL} THEN 1 END)`, 'countOut')
      .addSelect(
        `COALESCE(SUM(CASE WHEN ${PLANNED_OUT_SQL} THEN f.amount ELSE 0 END), 0)`,
        'pendingOutAmount',
      )
      .addSelect(
        `COUNT(CASE WHEN ${PLANNED_OUT_SQL} THEN 1 END)`,
        'pendingOutCount',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN ${PENDING_IN_SQL} THEN f.amount ELSE 0 END), 0)`,
        'pendingInAmount',
      )
      .addSelect(
        `COUNT(CASE WHEN ${PENDING_IN_SQL} THEN 1 END)`,
        'pendingInCount',
      )
      .getRawOne<Record<string, string | number | null>>();

    const num = (key: string): number => Number(raw?.[key] ?? 0);
    const totalIn = num('totalIn');
    const totalOut = num('totalOut');
    return {
      totalIn,
      totalOut,
      net: totalIn - totalOut,
      countIn: num('countIn'),
      countOut: num('countOut'),
      pendingOutAmount: num('pendingOutAmount'),
      pendingOutCount: num('pendingOutCount'),
      pendingInAmount: num('pendingInAmount'),
      pendingInCount: num('pendingInCount'),
    };
  }

  /** Phân nhóm theo phương thức hoặc nội dung, tách thu và chi, sắp giảm dần theo số tiền. */
  private async getBreakdown(
    query: GarageCashflowDashboardQueryDto,
    groupExpr: string,
  ): Promise<{
    in: Array<{ name: string; amount: number; count: number }>;
    out: Array<{ name: string; amount: number; count: number }>;
  }> {
    const fetch = async (direction: 'IN' | 'OUT') => {
      const qb = this.baseQb();
      this.applyBaseFilters(qb, query);
      const raw = await qb
        .select(`COALESCE(NULLIF(${groupExpr}, ''), 'Khác')`, 'name')
        .addSelect('SUM(f.amount)', 'amount')
        .addSelect('COUNT(1)', 'count')
        .andWhere('f.direction = :direction', { direction })
        .groupBy(`COALESCE(NULLIF(${groupExpr}, ''), 'Khác')`)
        .orderBy('SUM(f.amount)', 'DESC')
        .getRawMany<{ name: string | null; amount: string; count: string }>();
      return raw.map((r) => ({
        name: String(r.name ?? 'Khác'),
        amount: Number(r.amount ?? 0),
        count: Number(r.count ?? 0),
      }));
    };
    const [inRows, outRows] = await Promise.all([fetch('IN'), fetch('OUT')]);
    return { in: inRows, out: outRows };
  }

  private getMethodBreakdown(
    query: GarageCashflowDashboardQueryDto,
  ): Promise<GarageCashflowMethodBreakdownDto> {
    return this.getBreakdown(query, 'ext.legacy_payment_method');
  }

  private getContentBreakdown(
    query: GarageCashflowDashboardQueryDto,
  ): Promise<GarageCashflowContentBreakdownDto> {
    return this.getBreakdown(query, 'ext.payment_content');
  }

  private async getTrend(
    query: GarageCashflowDashboardQueryDto,
  ): Promise<GarageCashflowTrendItemDto[]> {
    const qb = this.baseQb();
    this.applyBaseFilters(qb, query);
    const raw = await qb
      .select(`TO_CHAR(f.planned_date, 'YYYY-MM')`, 'label')
      .addSelect(
        `SUM(CASE WHEN ${ACTUAL_IN_SQL} THEN f.amount ELSE 0 END)`,
        'cashIn',
      )
      .addSelect(
        `SUM(CASE WHEN ${ACTUAL_OUT_SQL} THEN f.amount ELSE 0 END)`,
        'cashOut',
      )
      .groupBy(`TO_CHAR(f.planned_date, 'YYYY-MM')`)
      .orderBy(`TO_CHAR(f.planned_date, 'YYYY-MM')`, 'DESC')
      .limit(6)
      .getRawMany<{
        label: string;
        cashIn: string | null;
        cashOut: string | null;
      }>();

    return raw
      .map((r) => {
        const cashIn = Number(r.cashIn ?? 0);
        const cashOut = Number(r.cashOut ?? 0);
        return {
          label: String(r.label ?? ''),
          cashIn,
          cashOut,
          net: cashIn - cashOut,
        };
      })
      .reverse();
  }

  private async getTopTransactions(
    query: GarageCashflowDashboardQueryDto,
  ): Promise<GarageCashflowTopTransactionsDto> {
    const fetchTop = async (direction: 'IN' | 'OUT') => {
      const qb = this.baseQb();
      this.applyBaseFilters(qb, query);
      const raw = await qb
        .select([
          'f.id AS id',
          'f.code AS "voucherCode"',
          'f.plannedDate AS "transDate"',
          'f.amount AS amount',
          'f.partnerName AS "partnerName"',
          'ext.licensePlate AS "licensePlate"',
          'ext.legacyPaymentMethod AS "paymentMethod"',
          'ext.paymentContent AS "paymentContent"',
          `${PAYMENT_STATUS_SQL} AS "paymentStatus"`,
          'kc.soChungTu AS "caseCode"',
          'ext.caseId AS "caseId"',
        ])
        .andWhere('f.direction = :direction', { direction })
        .orderBy('f.amount', 'DESC')
        .limit(5)
        .getRawMany<LegacyTopRow>();

      return raw.map((r) => ({
        id: String(r.id),
        voucherCode: r.voucherCode ?? '',
        transDate: String(r.transDate ?? '').substring(0, 10),
        amount: Number(r.amount ?? 0),
        partnerName: r.partnerName,
        licensePlate: r.licensePlate,
        paymentMethod: r.paymentMethod,
        paymentContent: r.paymentContent,
        paymentStatus: r.paymentStatus as LegacyPaymentStatus | null,
        caseCode: r.caseCode,
        caseId: r.caseId,
      }));
    };

    const [topIn, topOut] = await Promise.all([
      fetchTop('IN'),
      fetchTop('OUT'),
    ]);
    return { in: topIn, out: topOut };
  }
}
