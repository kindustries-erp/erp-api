import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KgaraCase } from '../entities/kgara_case.entity';
import { KgaraPayable } from '../entities/kgara_payable.entity';
import { KgaraCaseSettlement } from '../entities/kgara_case_settlement.entity';
import {
  GarageDebtsAnalyticsResponse,
  GarageTimeHorizonCasesResponse,
  GetGarageTimeHorizonCasesQueryDto,
  GarageTopDebtPartnerItem,
} from '../dto/garage-debts-analytics.dto';
import {
  getHorizonCaseSqlCondition,
  getHorizonPayableSqlCondition,
  getHorizonTitle,
  buildAgingComparisonMatrix,
  calculateIfrs9Provisions,
} from '../helpers/garage-debts-horizon.helper';

@Injectable()
export class GarageDebtsAnalyticsService {
  private readonly logger = new Logger(GarageDebtsAnalyticsService.name);

  constructor(
    @InjectRepository(KgaraCase)
    private readonly caseRepo: Repository<KgaraCase>,
    @InjectRepository(KgaraPayable)
    private readonly payableRepo: Repository<KgaraPayable>,
    @InjectRepository(KgaraCaseSettlement)
    private readonly settlementRepo: Repository<KgaraCaseSettlement>,
  ) {}

  /**
   * 1. Tổng quan phân tích công nợ, ma trận 4 tầng tuổi nợ và dự báo dòng tiền Garage
   */
  async getDebtsAnalytics(
    dateFrom?: string,
    dateTo?: string,
    branchId?: string,
  ): Promise<GarageDebtsAnalyticsResponse> {
    const baseline = '2026-07-01';
    const effectiveFrom = dateFrom && dateFrom > baseline ? dateFrom : baseline;

    const caseParams: any[] = [effectiveFrom];
    let caseWhere = `
      "c"."kgara_deleted_at" IS NULL
      AND ("c"."exclude_from_reports" IS NOT TRUE)
      AND ("c"."exclude_from_debt" IS NOT TRUE)
      AND "c"."ngay_hoan_thanh_cong_viec" IS NOT NULL
      AND "c"."ngay_hoan_thanh_cong_viec" >= $1
    `;
    if (branchId) {
      caseParams.push(branchId);
      caseWhere += ` AND "c"."branch_external_id" = $${caseParams.length}`;
    }
    if (dateTo) {
      const effTo = dateTo.length === 10 ? `${dateTo} 23:59:59.999` : dateTo;
      caseParams.push(effTo);
      caseWhere += ` AND "c"."ngay_hoan_thanh_cong_viec" <= $${caseParams.length}`;
    }

    // 1.1 Tổng hợp Phải thu Khách hàng (Receivables)
    const caseAggSql = `
      SELECT
        COALESCE(SUM("c"."tien_co_thue"), 0)::numeric as "totalReceivable",
        COALESCE(SUM("c"."tien_da_thanh_toan"), 0)::numeric as "paidReceivable",
        COALESCE(SUM("c"."tien_con_phai_thanh_toan"), 0)::numeric as "remainingReceivable",
        COALESCE(SUM(CASE WHEN "c"."tien_con_phai_thanh_toan" > 0 AND (CURRENT_DATE - DATE("c"."ngay_hoan_thanh_cong_viec")) <= 30 THEN "c"."tien_con_phai_thanh_toan" ELSE 0 END), 0)::numeric as "aging0To30",
        COALESCE(SUM(CASE WHEN "c"."tien_con_phai_thanh_toan" > 0 AND (CURRENT_DATE - DATE("c"."ngay_hoan_thanh_cong_viec")) BETWEEN 31 AND 60 THEN "c"."tien_con_phai_thanh_toan" ELSE 0 END), 0)::numeric as "aging31To60",
        COALESCE(SUM(CASE WHEN "c"."tien_con_phai_thanh_toan" > 0 AND (CURRENT_DATE - DATE("c"."ngay_hoan_thanh_cong_viec")) BETWEEN 61 AND 90 THEN "c"."tien_con_phai_thanh_toan" ELSE 0 END), 0)::numeric as "aging61To90",
        COALESCE(SUM(CASE WHEN "c"."tien_con_phai_thanh_toan" > 0 AND (CURRENT_DATE - DATE("c"."ngay_hoan_thanh_cong_viec")) > 90 THEN "c"."tien_con_phai_thanh_toan" ELSE 0 END), 0)::numeric as "agingOver90",
        COALESCE(SUM(CASE WHEN "c"."tien_con_phai_thanh_toan" > 0 AND (CURRENT_DATE - DATE("c"."ngay_hoan_thanh_cong_viec")) <= 7 THEN "c"."tien_con_phai_thanh_toan" ELSE 0 END), 0)::numeric as "dueNextWeek"
      FROM "kgara_cases" "c"
      WHERE ${caseWhere}
    `;
    const caseAggRows = await this.caseRepo.manager.query(
      caseAggSql,
      caseParams,
    );
    const caseAgg = caseAggRows[0] || {};

    const totalRec = Number(caseAgg.totalReceivable) || 0;
    const paidRec = Number(caseAgg.paidReceivable) || 0;
    const remRec = Number(caseAgg.remainingReceivable) || 0;
    const r0_30 = Number(caseAgg.aging0To30) || 0;
    const r31_60 = Number(caseAgg.aging31To60) || 0;
    const r61_90 = Number(caseAgg.aging61To90) || 0;
    const rOver90 = Number(caseAgg.agingOver90) || 0;
    const rDueWeek = Number(caseAgg.dueNextWeek) || 0;

    // 1.2 Tổng hợp Phải trả Nhà cung cấp / Chi phí sổ báo giá (Payables)
    const payableParams: any[] = [effectiveFrom];
    const dateExpr =
      'COALESCE("c"."ngay_hoan_thanh_cong_viec", ("gp"."raw_data"->>\'NgayKetThuc\')::timestamp, "c"."ngay_phat_sinh")';
    const costExpr = 'COALESCE("gp"."chi_phi", "c"."chi_phi", 0)::numeric';

    let payableWhere = `
      ("c"."id" IS NULL OR "c"."kgara_deleted_at" IS NULL)
      AND ("c"."id" IS NULL OR "c"."exclude_from_reports" IS NOT TRUE)
      AND ("c"."id" IS NULL OR "c"."exclude_from_debt" IS NOT TRUE)
      AND ${costExpr} > 0
      AND ${dateExpr} >= $1
    `;
    if (branchId) {
      payableParams.push(branchId);
      payableWhere += ` AND (COALESCE("c"."branch_external_id", "gp"."branch_external_id") = $${payableParams.length})`;
    }
    if (dateTo) {
      const effTo = dateTo.length === 10 ? `${dateTo} 23:59:59.999` : dateTo;
      payableParams.push(effTo);
      payableWhere += ` AND ${dateExpr} <= $${payableParams.length}`;
    }

    const agingDaysExpr = `(CURRENT_DATE - DATE(${dateExpr}))`;

    const payableAggSql = `
      SELECT
        COALESCE(SUM(${costExpr}), 0)::numeric as "totalPayable",
        0::numeric as "paidPayable",
        COALESCE(SUM(${costExpr}), 0)::numeric as "remainingPayable",
        COALESCE(SUM(CASE WHEN ${agingDaysExpr} <= 30 THEN ${costExpr} ELSE 0 END), 0)::numeric as "aging0To30",
        COALESCE(SUM(CASE WHEN ${agingDaysExpr} BETWEEN 31 AND 60 THEN ${costExpr} ELSE 0 END), 0)::numeric as "aging31To60",
        COALESCE(SUM(CASE WHEN ${agingDaysExpr} BETWEEN 61 AND 90 THEN ${costExpr} ELSE 0 END), 0)::numeric as "aging61To90",
        COALESCE(SUM(CASE WHEN ${agingDaysExpr} > 90 THEN ${costExpr} ELSE 0 END), 0)::numeric as "agingOver90",
        COALESCE(SUM(CASE WHEN ${agingDaysExpr} <= 7 THEN ${costExpr} ELSE 0 END), 0)::numeric as "dueNextWeek"
      FROM "kgara_cases" "c"
      FULL OUTER JOIN "kgara_gross_profit" "gp" ON "gp"."vu_viec_code" = "c"."so_chung_tu"
      WHERE ${payableWhere}
    `;
    const payableAggRows = await this.caseRepo.manager.query(
      payableAggSql,
      payableParams,
    );
    const payableAgg = payableAggRows[0] || {};

    const totalPay = Number(payableAgg.totalPayable) || 0;
    const paidPay = Number(payableAgg.paidPayable) || 0;
    const remPay = Number(payableAgg.remainingPayable) || 0;
    const p0_30 = Number(payableAgg.aging0To30) || 0;
    const p31_60 = Number(payableAgg.aging31To60) || 0;
    const p61_90 = Number(payableAgg.aging61To90) || 0;
    const pOver90 = Number(payableAgg.agingOver90) || 0;
    const pDueWeek = Number(payableAgg.dueNextWeek) || 0;

    // 1.3 Monthly Trend (Tháng gần nhất)
    const trendSql = `
      SELECT
        TO_CHAR("c"."ngay_hoan_thanh_cong_viec", 'YYYY-MM') as "month",
        COALESCE(SUM("c"."tien_da_thanh_toan"), 0)::numeric as "cashIn",
        COALESCE(SUM(COALESCE("gp"."chi_phi", "c"."chi_phi", 0)), 0)::numeric as "cashOut"
      FROM "kgara_cases" "c"
      LEFT JOIN "kgara_gross_profit" "gp" ON "gp"."vu_viec_code" = "c"."so_chung_tu"
      WHERE ${caseWhere}
      GROUP BY TO_CHAR("c"."ngay_hoan_thanh_cong_viec", 'YYYY-MM')
      ORDER BY "month" ASC
    `;
    const trendRows = await this.caseRepo.manager.query(trendSql, caseParams);
    const cashTrend = trendRows.map((r: any) => {
      const cIn = Number(r.cashIn) || 0;
      const cOut = Number(r.cashOut) || 0;
      return {
        label: r.month,
        cashIn: cIn,
        cashOut: cOut,
        netCash: cIn - cOut,
      };
    });

    // 1.4 Top 5 Khách hàng nợ lớn nhất
    const topCustSql = `
      SELECT
        COALESCE("c"."khach_hang_code", 'UNKNOWN') as "partnerCode",
        MAX(COALESCE("c"."khach_hang_name", 'Chưa xác định')) as "partnerName",
        COALESCE(SUM("c"."tien_co_thue"), 0)::numeric as "totalAmount",
        COALESCE(SUM("c"."tien_con_phai_thanh_toan"), 0)::numeric as "balanceAmount",
        COALESCE(SUM(CASE WHEN (CURRENT_DATE - DATE("c"."ngay_hoan_thanh_cong_viec")) > 30 THEN "c"."tien_con_phai_thanh_toan" ELSE 0 END), 0)::numeric as "overdueAmount",
        COALESCE(MAX(CURRENT_DATE - DATE("c"."ngay_hoan_thanh_cong_viec")), 0)::int as "maxAgingDays",
        COUNT("c"."id")::int as "caseCount"
      FROM "kgara_cases" "c"
      WHERE ${caseWhere} AND "c"."tien_con_phai_thanh_toan" > 0
      GROUP BY COALESCE("c"."khach_hang_code", 'UNKNOWN')
      ORDER BY "balanceAmount" DESC
      LIMIT 5
    `;
    const topCustRows = await this.caseRepo.manager.query(
      topCustSql,
      caseParams,
    );
    const topReceivableCustomers: GarageTopDebtPartnerItem[] = topCustRows.map(
      (r: any) => ({
        partnerCode: r.partnerCode,
        partnerName: r.partnerName,
        totalAmount: Number(r.totalAmount) || 0,
        balanceAmount: Number(r.balanceAmount) || 0,
        overdueAmount: Number(r.overdueAmount) || 0,
        maxAgingDays: Number(r.maxAgingDays) || 0,
        caseCount: Number(r.caseCount) || 0,
      }),
    );

    // 1.5 Top 5 Khách hàng có chi phí lớn nhất (Phải trả)
    const topSuppSql = `
      SELECT
        COALESCE("c"."khach_hang_code", "gp"."raw_data"->>'MaKhachHang', "gp"."ten_khach_hang", 'UNKNOWN') as "partnerCode",
        COALESCE("c"."khach_hang_name", "gp"."ten_khach_hang", 'Chưa xác định') as "partnerName",
        COALESCE(SUM(${costExpr}), 0)::numeric as "totalAmount",
        COALESCE(SUM(${costExpr}), 0)::numeric as "balanceAmount",
        COALESCE(SUM(CASE WHEN ${agingDaysExpr} > 30 THEN ${costExpr} ELSE 0 END), 0)::numeric as "overdueAmount",
        COALESCE(MAX(${agingDaysExpr}), 0)::int as "maxAgingDays",
        COUNT(DISTINCT COALESCE("c"."so_chung_tu", "gp"."vu_viec_code"))::int as "caseCount"
      FROM "kgara_cases" "c"
      FULL OUTER JOIN "kgara_gross_profit" "gp" ON "gp"."vu_viec_code" = "c"."so_chung_tu"
      WHERE ${payableWhere}
      GROUP BY COALESCE("c"."khach_hang_code", "gp"."raw_data"->>'MaKhachHang', "gp"."ten_khach_hang", 'UNKNOWN'), COALESCE("c"."khach_hang_name", "gp"."ten_khach_hang", 'Chưa xác định')
      ORDER BY "balanceAmount" DESC
      LIMIT 5
    `;
    const topSuppRows = await this.caseRepo.manager.query(
      topSuppSql,
      payableParams,
    );
    const topPayableSuppliers: GarageTopDebtPartnerItem[] = topSuppRows.map(
      (r: any) => ({
        partnerCode: r.partnerCode,
        partnerName: r.partnerName,
        totalAmount: Number(r.totalAmount) || 0,
        balanceAmount: Number(r.balanceAmount) || 0,
        overdueAmount: Number(r.overdueAmount) || 0,
        maxAgingDays: Number(r.maxAgingDays) || 0,
        caseCount: Number(r.caseCount) || 0,
      }),
    );

    const agingComparison = buildAgingComparisonMatrix(
      r0_30,
      r31_60,
      r61_90,
      rOver90,
      p0_30,
      p31_60,
      p61_90,
      pOver90,
    );

    const timeHorizons = {
      nextWeekDue: {
        receivable: rDueWeek,
        payable: pDueWeek,
        net: rDueWeek - pDueWeek,
      },
      nextMonthDue: { receivable: r0_30, payable: p0_30, net: r0_30 - p0_30 },
      overdue30To90: {
        receivable: r31_60 + r61_90,
        payable: p31_60 + p61_90,
        net: r31_60 + r61_90 - (p31_60 + p61_90),
      },
      criticalOverdue90Plus: {
        receivable: rOver90,
        payable: pOver90,
        net: rOver90 - pOver90,
      },
    };

    const forecastHorizons = calculateIfrs9Provisions(
      r0_30,
      r31_60,
      r61_90,
      rOver90,
      p0_30,
      p31_60,
      p61_90,
      pOver90,
      rDueWeek,
      pDueWeek,
      r0_30,
      p0_30,
    );

    return {
      summary: {
        totalReceivable: totalRec,
        paidReceivable: paidRec,
        remainingReceivable: remRec,
        totalPayable: totalPay,
        paidPayable: paidPay,
        remainingPayable: remPay,
        netBalance: remRec - remPay,
        collectionRate:
          totalRec > 0 ? Math.round((paidRec / totalRec) * 1000) / 10 : 0,
        paymentRate:
          totalPay > 0 ? Math.round((paidPay / totalPay) * 1000) / 10 : 0,
      },
      agingComparison,
      timeHorizons,
      forecastHorizons,
      cashTrend,
      topReceivableCustomers,
      topPayableSuppliers,
    };
  }

  /**
   * 2. Lấy danh sách chi tiết các vụ việc theo mốc thời gian (Time Horizon) cho Drawer
   */
  async getTimeHorizonCases(
    horizon: string,
    query: GetGarageTimeHorizonCasesQueryDto = {} as any,
  ): Promise<GarageTimeHorizonCasesResponse> {
    const q = query || ({} as any);
    const effectiveDateFrom = q.date_from || q.dateFrom;
    const effectiveDateTo = q.date_to || q.dateTo;
    const effectiveBranchId = q.branch_id || q.branchId;
    const direction = q.direction || 'ALL';
    const search = q.search;
    const page = q.page || 1;
    const pageSize = q.pageSize || 20;
    const sortBy = q.sortBy || 'agingDays';
    const sortOrder = q.sortOrder || 'DESC';

    const baseline = '2026-07-01';
    const effectiveFrom =
      effectiveDateFrom && effectiveDateFrom > baseline
        ? effectiveDateFrom
        : baseline;

    const horizonCaseCond = getHorizonCaseSqlCondition(horizon, 'c');
    const horizonTitle = getHorizonTitle(horizon);

    const queryParams: any[] = [effectiveFrom];
    let whereSql = `
      "c"."kgara_deleted_at" IS NULL
      AND ("c"."exclude_from_reports" IS NOT TRUE)
      AND ("c"."exclude_from_debt" IS NOT TRUE)
      AND "c"."ngay_hoan_thanh_cong_viec" IS NOT NULL
      AND "c"."ngay_hoan_thanh_cong_viec" >= $1
      AND ${horizonCaseCond}
    `;

    if (effectiveBranchId) {
      queryParams.push(effectiveBranchId);
      whereSql += ` AND "c"."branch_external_id" = $${queryParams.length}`;
    }
    if (effectiveDateTo) {
      const effTo =
        effectiveDateTo.length === 10
          ? `${effectiveDateTo} 23:59:59.999`
          : effectiveDateTo;
      queryParams.push(effTo);
      whereSql += ` AND "c"."ngay_hoan_thanh_cong_viec" <= $${queryParams.length}`;
    }
    if (search) {
      queryParams.push(`%${search}%`);
      whereSql += ` AND ("c"."so_chung_tu" ILIKE $${queryParams.length} OR "c"."khach_hang_name" ILIKE $${queryParams.length} OR "c"."bien_so_xe" ILIKE $${queryParams.length})`;
    }

    // 2.1 Đếm tổng số bản ghi
    const countSql = `SELECT COUNT("c"."id")::int as total FROM "kgara_cases" "c" WHERE ${whereSql}`;
    const countRes = await this.caseRepo.manager.query(countSql, queryParams);
    const total = Number(countRes[0]?.total) || 0;

    // 2.2 Sắp xếp & Phân trang
    let orderSql = 'ORDER BY "agingDays" DESC';
    const dir = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    if (sortBy === 'totalAmount') orderSql = `ORDER BY "totalAmount" ${dir}`;
    else if (sortBy === 'balanceAmount')
      orderSql = `ORDER BY "balanceAmount" ${dir}`;
    else if (sortBy === 'completionDate')
      orderSql = `ORDER BY "completionDate" ${dir}`;
    else if (sortBy === 'soChungTu') orderSql = `ORDER BY "soChungTu" ${dir}`;
    else if (sortBy === 'customerName')
      orderSql = `ORDER BY "customerName" ${dir}`;

    const limit = Math.max(1, pageSize);
    const offset = (Math.max(1, page) - 1) * limit;

    const dataSql = `
      SELECT
        "c"."id",
        "c"."hd_phieu_dich_vu_id" as "caseId",
        "c"."so_chung_tu" as "soChungTu",
        "c"."bien_so_xe" as "bienSoXe",
        "c"."khach_hang_code" as "customerCode",
        "c"."khach_hang_name" as "customerName",
        'OUT' as "direction",
        COALESCE("c"."tien_co_thue", 0)::numeric as "totalAmount",
        COALESCE("c"."tien_da_thanh_toan", 0)::numeric as "paidAmount",
        COALESCE("c"."tien_con_phai_thanh_toan", 0)::numeric as "balanceAmount",
        TO_CHAR("c"."ngay_hoan_thanh_cong_viec", 'YYYY-MM-DD"T"HH24:MI:SS') as "completionDate",
        COALESCE(CURRENT_DATE - DATE("c"."ngay_hoan_thanh_cong_viec"), 0)::int as "agingDays",
        "c"."branch_external_id" as "branchExternalId",
        COALESCE("c"."ten_tinh_trang_dich_vu", 'Hoàn tất') as "status",
        COALESCE("c"."erp_notes", '') as "description"
      FROM "kgara_cases" "c"
      WHERE ${whereSql}
      ${orderSql}
      LIMIT ${limit} OFFSET ${offset}
    `;
    const rows = await this.caseRepo.manager.query(dataSql, queryParams);

    // 2.3 Tổng hợp summary mốc thời gian
    const sumSql = `
      SELECT
        COALESCE(SUM("c"."tien_co_thue"), 0)::numeric as "totalAmount",
        COALESCE(SUM("c"."tien_da_thanh_toan"), 0)::numeric as "paidAmount",
        COALESCE(SUM("c"."tien_con_phai_thanh_toan"), 0)::numeric as "balanceAmount",
        COUNT("c"."id")::int as "count"
      FROM "kgara_cases" "c"
      WHERE ${whereSql}
    `;
    const sumRes = await this.caseRepo.manager.query(sumSql, queryParams);
    const s = sumRes[0] || {};
    const sumTotal = Number(s.totalAmount) || 0;
    const sumPaid = Number(s.paidAmount) || 0;
    const sumBal = Number(s.balanceAmount) || 0;
    const sumCount = Number(s.count) || 0;

    // 2.4 Top 5 Đối tác nợ lớn trong Horizon
    const topPartSql = `
      SELECT
        COALESCE("c"."khach_hang_code", 'UNKNOWN') as "partnerCode",
        MAX(COALESCE("c"."khach_hang_name", 'Khách hàng')) as "partnerName",
        COALESCE(SUM("c"."tien_con_phai_thanh_toan"), 0)::numeric as "balanceAmount",
        COUNT("c"."id")::int as "caseCount"
      FROM "kgara_cases" "c"
      WHERE ${whereSql} AND "c"."tien_con_phai_thanh_toan" > 0
      GROUP BY COALESCE("c"."khach_hang_code", 'UNKNOWN')
      ORDER BY "balanceAmount" DESC
      LIMIT 5
    `;
    const topPartRows = await this.caseRepo.manager.query(
      topPartSql,
      queryParams,
    );
    const topPartners = topPartRows.map((r: any) => {
      const bAmt = Number(r.balanceAmount) || 0;
      return {
        partnerCode: r.partnerCode,
        partnerName: r.partnerName,
        partnerType: 'CUSTOMER' as const,
        balanceAmount: bAmt,
        caseCount: Number(r.caseCount) || 0,
        sharePercentage:
          sumBal > 0 ? Math.round((bAmt / sumBal) * 1000) / 10 : 0,
      };
    });

    return {
      summary: {
        horizon,
        horizonLabel: horizonTitle,
        receivableAmount: sumBal,
        payableAmount: 0,
        receivableTotalAmount: sumTotal,
        payableTotalAmount: 0,
        receivedAmount: sumPaid,
        paidAmount: 0,
        netAmount: sumBal,
        receivableCount: sumCount,
        payableCount: 0,
        topPartners,
        branchBreakdown: [],
        monthlyTrend: [],
      },
      items: rows.map((r: any) => ({
        id: r.id,
        caseId: r.caseId,
        soChungTu: r.soChungTu,
        bienSoXe: r.bienSoXe,
        customerCode: r.customerCode,
        customerName: r.customerName,
        direction: 'OUT',
        totalAmount: Number(r.totalAmount) || 0,
        paidAmount: Number(r.paidAmount) || 0,
        balanceAmount: Number(r.balanceAmount) || 0,
        completionDate: r.completionDate,
        agingDays: Number(r.agingDays) || 0,
        branchExternalId: r.branchExternalId,
        status: r.status,
        description: r.description,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / limit),
    };
  }
}
