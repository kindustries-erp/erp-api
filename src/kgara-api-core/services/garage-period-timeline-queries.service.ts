import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { KgaraCase } from '../entities/kgara_case.entity';
import { KGARA_STATUS_COMPLETED } from '../helpers/kgara-completion-date.helper';
import {
  PAYMENT_BY_CASE_JOIN,
  buildPayableExprs,
} from '../helpers/garage-payable-settlement.helper';
import { GARAGE_DEBT_BASELINE_DATE } from './kgara-customers-debt-query.service';

/** Doanh thu và giá vốn từ phiếu của một ngày hoàn thành (chưa gồm điều chỉnh giá vốn nhập tay theo tháng). */
export interface RevenueTimelineRow {
  /** `YYYY-MM-DD`. */
  date: string;
  revenue: number;
  cogs: number;
}

/** Công nợ phát sinh và đã thu/trả của các phiếu hoàn thành trong một ngày. */
export interface DebtTimelineRow {
  /** `YYYY-MM-DD`. */
  date: string;
  /** Phải thu: tổng tiền có thuế / đã thanh toán. */
  arTotal: number;
  arPaid: number;
  /** Phải trả: chi phí / đã chi (cấn trừ PAYMENT). */
  apTotal: number;
  apPaid: number;
}

const toDay = (value?: string) => (value ? value.slice(0, 10) : undefined);
const endOfDay = (value: string) =>
  value.length === 10 ? `${value} 23:59:59.999` : value;
const num = (value: unknown) => Number(value) || 0;

/**
 * Truy vấn theo ngày cho chart của báo cáo Garage theo kỳ. Dùng chung điều kiện lọc với
 * `GaragePnlService.getPnlReport` (doanh thu) và `GarageDebtsAnalyticsService` (công nợ);
 * gom mốc ngày/tuần/tháng làm ở `garage-period-bucket.helper.ts`.
 */
@Injectable()
export class GaragePeriodTimelineQueries {
  constructor(
    @InjectRepository(KgaraCase)
    private readonly caseRepo: Repository<KgaraCase>,
  ) {}

  /**
   * Doanh thu, giá vốn theo ngày hoàn thành phiếu trong kỳ. Không lọc chi nhánh để khớp
   * báo cáo P&L (P&L không có chi nhánh). Thiếu `from` hoặc `to` thì trả rỗng.
   */
  async loadRevenueTimeline(
    from?: string,
    to?: string,
  ): Promise<RevenueTimelineRow[]> {
    const dayFrom = toDay(from);
    const dayTo = toDay(to);
    if (!dayFrom || !dayTo) return [];

    const rows = await this.caseRepo.manager.query(
      `
      SELECT
        TO_CHAR(DATE("c"."ngay_hoan_thanh_cong_viec"), 'YYYY-MM-DD') AS "day",
        COALESCE(SUM(COALESCE("gp"."doanh_thu", "c"."doanh_thu", "c"."tien_co_thue", 0)), 0)::numeric AS "revenue",
        COALESCE(SUM(COALESCE("gp"."chi_phi", "c"."chi_phi", 0)), 0)::numeric AS "cogs"
      FROM "kgara_cases" "c"
      LEFT JOIN "kgara_gross_profit" "gp"
        ON "gp"."hd_phieu_dich_vu_id" = "c"."hd_phieu_dich_vu_id" OR "gp"."vu_viec_code" = "c"."so_chung_tu"
      WHERE "c"."kgara_deleted_at" IS NULL
        AND ("c"."exclude_from_reports" IS NOT TRUE)
        AND ("c"."tinh_trang_dich_vu" IS NULL OR "c"."tinh_trang_dich_vu" != 9)
        AND "c"."ngay_hoan_thanh_cong_viec" IS NOT NULL
        AND "c"."ngay_hoan_thanh_cong_viec" >= $1
        AND "c"."ngay_hoan_thanh_cong_viec" <= $2
      GROUP BY 1
      ORDER BY 1
      `,
      [dayFrom, endOfDay(dayTo)],
    );

    return rows.map((r: any) => ({
      date: String(r.day),
      revenue: num(r.revenue),
      cogs: num(r.cogs),
    }));
  }

  /**
   * Công nợ phát sinh và đã thu/trả theo ngày hoàn thành phiếu trong kỳ (chỉ tính từ mốc
   * ghi nhận công nợ). Thiếu `from` hoặc `to` thì trả rỗng.
   */
  async loadDebtTimeline(
    from?: string,
    to?: string,
    branchId?: string,
  ): Promise<DebtTimelineRow[]> {
    const dayFrom = toDay(from);
    const dayTo = toDay(to);
    if (!dayFrom || !dayTo) return [];

    const effectiveFrom =
      dayFrom > GARAGE_DEBT_BASELINE_DATE ? dayFrom : GARAGE_DEBT_BASELINE_DATE;
    const effectiveTo = endOfDay(dayTo);

    const [receivable, payable] = await Promise.all([
      this.queryReceivable(effectiveFrom, effectiveTo, branchId),
      this.queryPayable(effectiveFrom, effectiveTo, branchId),
    ]);

    const merged = new Map<string, DebtTimelineRow>();
    const rowOf = (date: string) => {
      const existing = merged.get(date);
      if (existing) return existing;
      const created = { date, arTotal: 0, arPaid: 0, apTotal: 0, apPaid: 0 };
      merged.set(date, created);
      return created;
    };
    for (const r of receivable) {
      const row = rowOf(String(r.day));
      row.arTotal = num(r.total);
      row.arPaid = num(r.paid);
    }
    for (const r of payable) {
      const row = rowOf(String(r.day));
      row.apTotal = num(r.total);
      row.apPaid = num(r.paid);
    }
    return [...merged.values()].sort((a, b) => a.date.localeCompare(b.date));
  }

  private queryReceivable(from: string, to: string, branchId?: string) {
    const params: unknown[] = [from, to];
    let where = `
      "c"."kgara_deleted_at" IS NULL
      AND "c"."tinh_trang_dich_vu" = ${KGARA_STATUS_COMPLETED}
      AND ("c"."exclude_from_reports" IS NOT TRUE)
      AND ("c"."exclude_from_debt" IS NOT TRUE)
      AND "c"."ngay_hoan_thanh_cong_viec" IS NOT NULL
      AND "c"."ngay_hoan_thanh_cong_viec" >= $1
      AND "c"."ngay_hoan_thanh_cong_viec" <= $2
    `;
    if (branchId) {
      params.push(branchId);
      where += ` AND "c"."branch_external_id" = $${params.length}`;
    }
    return this.caseRepo.manager.query(
      `
      SELECT
        TO_CHAR(DATE("c"."ngay_hoan_thanh_cong_viec"), 'YYYY-MM-DD') AS "day",
        COALESCE(SUM("c"."tien_co_thue"), 0)::numeric AS "total",
        COALESCE(SUM("c"."tien_da_thanh_toan"), 0)::numeric AS "paid"
      FROM "kgara_cases" "c"
      WHERE ${where}
      GROUP BY 1
      ORDER BY 1
      `,
      params,
    ) as Promise<any[]>;
  }

  private queryPayable(from: string, to: string, branchId?: string) {
    const dateExpr =
      'COALESCE("c"."ngay_hoan_thanh_cong_viec", ("gp"."raw_data"->>\'NgayKetThuc\')::timestamp, "c"."ngay_phat_sinh")';
    const costExpr = 'COALESCE("gp"."chi_phi", "c"."chi_phi", 0)::numeric';
    const { paidExpr, hasPayableCondition } = buildPayableExprs(costExpr);

    const params: unknown[] = [from, to];
    let where = `
      "c"."id" IS NOT NULL
      AND "c"."tinh_trang_dich_vu" = ${KGARA_STATUS_COMPLETED}
      AND "c"."kgara_deleted_at" IS NULL
      AND ("c"."exclude_from_reports" IS NOT TRUE)
      AND ("c"."exclude_from_debt" IS NOT TRUE)
      AND ${hasPayableCondition}
      AND ${dateExpr} >= $1
      AND ${dateExpr} <= $2
    `;
    if (branchId) {
      params.push(branchId);
      where += ` AND (COALESCE("c"."branch_external_id", "gp"."branch_external_id") = $${params.length})`;
    }
    return this.caseRepo.manager.query(
      `
      SELECT
        TO_CHAR(DATE(${dateExpr}), 'YYYY-MM-DD') AS "day",
        COALESCE(SUM(${costExpr}), 0)::numeric AS "total",
        COALESCE(SUM(${paidExpr}), 0)::numeric AS "paid"
      FROM "kgara_cases" "c"
      FULL OUTER JOIN "kgara_gross_profit" "gp" ON "gp"."vu_viec_code" = "c"."so_chung_tu"
      ${PAYMENT_BY_CASE_JOIN}
      WHERE ${where}
      GROUP BY 1
      ORDER BY 1
      `,
      params,
    ) as Promise<any[]>;
  }
}
