import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KgaraCase } from './entities/kgara_case.entity';
import { KgaraCaseService } from './entities/kgara_case_service.entity';
import { KgaraGrossProfit } from './entities/kgara_gross_profit.entity';
import { KgaraCaseSettlement } from './entities/kgara_case_settlement.entity';
import { GarageOpexService } from './services/garage-opex.service';
import * as ExcelJS from 'exceljs';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  subMonths,
  subWeeks,
  subDays,
  format,
} from 'date-fns';

@Injectable()
export class GarageDashboardService {
  private readonly logger = new Logger(GarageDashboardService.name);

  constructor(
    @InjectRepository(KgaraCase)
    private readonly caseRepo: Repository<KgaraCase>,
    @InjectRepository(KgaraCaseService)
    private readonly caseServiceRepo: Repository<KgaraCaseService>,
    @InjectRepository(KgaraGrossProfit)
    private readonly grossProfitRepo: Repository<KgaraGrossProfit>,
    @InjectRepository(KgaraCaseSettlement)
    private readonly settlementRepo: Repository<KgaraCaseSettlement>,
    private readonly opexService: GarageOpexService,
  ) {}

  /**
   * 1. Lấy biểu đồ xu hướng theo tháng (Doanh thu, Giá vốn, Lợi nhuận gộp, Tiến độ thu tiền, Tiến độ trả tiền & Phân bổ trạng thái theo từng tháng)
   * Chỉ tính các vụ việc ĐÃ CÓ ngày hoàn thành công việc (ngay_hoan_thanh_cong_viec IS NOT NULL).
   */
  async getDashboardStats(dateFrom?: string, dateTo?: string) {
    const qb = this.caseRepo
      .createQueryBuilder('c')
      .leftJoin(
        KgaraGrossProfit,
        'gp',
        'gp.hd_phieu_dich_vu_id = c.hd_phieu_dich_vu_id OR gp.vu_viec_code = c.so_chung_tu',
      )
      .select("TO_CHAR(c.ngay_hoan_thanh_cong_viec, 'YYYY-MM')", 'month')
      .addSelect(
        'SUM(COALESCE(gp.doanh_thu, c.doanh_thu, c.tien_co_thue, 0))',
        'revenue',
      )
      .addSelect('SUM(COALESCE(gp.chi_phi, c.chi_phi, 0))', 'cost')
      .addSelect(
        'SUM(COALESCE(gp.loi_nhuan, c.loi_nhuan, COALESCE(gp.doanh_thu, c.doanh_thu, c.tien_co_thue, 0) - COALESCE(gp.chi_phi, c.chi_phi, 0), 0))',
        'profit',
      )
      .addSelect('SUM(COALESCE(c.tien_da_thanh_toan, 0))', 'paid')
      .addSelect('SUM(COALESCE(c.tien_con_phai_thanh_toan, 0))', 'receivable')
      .addSelect('SUM(COALESCE(c.tien_co_thue, 0))', 'tienCoThue')
      .addSelect('COUNT(c.id)', 'caseCount')
      .addSelect(
        "SUM(CASE WHEN (c.raw_data->>'TienThueKH' IS NOT NULL AND (c.raw_data->>'TienThueKH') ~ '^[0-9.]+$' AND (c.raw_data->>'TienThueKH')::numeric > 0) THEN COALESCE(c.tien_co_thue, 0) ELSE 0 END)",
        'tienCoThueWithInvoice',
      )
      .addSelect(
        "SUM(CASE WHEN NOT (c.raw_data->>'TienThueKH' IS NOT NULL AND (c.raw_data->>'TienThueKH') ~ '^[0-9.]+$' AND (c.raw_data->>'TienThueKH')::numeric > 0) THEN COALESCE(c.tien_co_thue, 0) ELSE 0 END)",
        'tienCoThueNoInvoice',
      )
      .addSelect(
        "SUM(CASE WHEN (c.raw_data->>'TienThueKH' IS NOT NULL AND (c.raw_data->>'TienThueKH') ~ '^[0-9.]+$' AND (c.raw_data->>'TienThueKH')::numeric > 0) THEN COALESCE(c.tien_da_thanh_toan, 0) ELSE 0 END)",
        'paidWithInvoice',
      )
      .addSelect(
        "SUM(CASE WHEN NOT (c.raw_data->>'TienThueKH' IS NOT NULL AND (c.raw_data->>'TienThueKH') ~ '^[0-9.]+$' AND (c.raw_data->>'TienThueKH')::numeric > 0) THEN COALESCE(c.tien_da_thanh_toan, 0) ELSE 0 END)",
        'paidNoInvoice',
      )
      .addSelect(
        "SUM(CASE WHEN (c.raw_data->>'TienThueKH' IS NOT NULL AND (c.raw_data->>'TienThueKH') ~ '^[0-9.]+$' AND (c.raw_data->>'TienThueKH')::numeric > 0) THEN COALESCE(c.tien_con_phai_thanh_toan, 0) ELSE 0 END)",
        'receivableWithInvoice',
      )
      .addSelect(
        "SUM(CASE WHEN NOT (c.raw_data->>'TienThueKH' IS NOT NULL AND (c.raw_data->>'TienThueKH') ~ '^[0-9.]+$' AND (c.raw_data->>'TienThueKH')::numeric > 0) THEN COALESCE(c.tien_con_phai_thanh_toan, 0) ELSE 0 END)",
        'receivableNoInvoice',
      )
      .addSelect(
        "SUM(CASE WHEN (c.raw_data->>'TienThueKH' IS NOT NULL AND (c.raw_data->>'TienThueKH') ~ '^[0-9.]+$' AND (c.raw_data->>'TienThueKH')::numeric > 0) THEN COALESCE(gp.doanh_thu, c.doanh_thu, c.tien_co_thue, 0) ELSE 0 END)",
        'revenueWithInvoice',
      )
      .addSelect(
        "SUM(CASE WHEN NOT (c.raw_data->>'TienThueKH' IS NOT NULL AND (c.raw_data->>'TienThueKH') ~ '^[0-9.]+$' AND (c.raw_data->>'TienThueKH')::numeric > 0) THEN COALESCE(gp.doanh_thu, c.doanh_thu, c.tien_co_thue, 0) ELSE 0 END)",
        'revenueNoInvoice',
      )
      .addSelect(
        "SUM(CASE WHEN (c.raw_data->>'TienThueKH' IS NOT NULL AND (c.raw_data->>'TienThueKH') ~ '^[0-9.]+$' AND (c.raw_data->>'TienThueKH')::numeric > 0) THEN COALESCE(gp.chi_phi, c.chi_phi, 0) ELSE 0 END)",
        'costWithInvoice',
      )
      .addSelect(
        "SUM(CASE WHEN NOT (c.raw_data->>'TienThueKH' IS NOT NULL AND (c.raw_data->>'TienThueKH') ~ '^[0-9.]+$' AND (c.raw_data->>'TienThueKH')::numeric > 0) THEN COALESCE(gp.chi_phi, c.chi_phi, 0) ELSE 0 END)",
        'costNoInvoice',
      )
      .addSelect(
        "COUNT(CASE WHEN (c.raw_data->>'TienThueKH' IS NOT NULL AND (c.raw_data->>'TienThueKH') ~ '^[0-9.]+$' AND (c.raw_data->>'TienThueKH')::numeric > 0) THEN c.id END)",
        'caseCountWithInvoice',
      )
      .addSelect(
        "COUNT(CASE WHEN NOT (c.raw_data->>'TienThueKH' IS NOT NULL AND (c.raw_data->>'TienThueKH') ~ '^[0-9.]+$' AND (c.raw_data->>'TienThueKH')::numeric > 0) THEN c.id END)",
        'caseCountNoInvoice',
      )
      .where('c.kgara_deleted_at IS NULL')
      .andWhere('(c.tinh_trang_dich_vu IS NULL OR c.tinh_trang_dich_vu != 9)')
      .andWhere('c.ngay_hoan_thanh_cong_viec IS NOT NULL');

    if (dateFrom) {
      qb.andWhere('c.ngay_hoan_thanh_cong_viec >= :dateFrom', {
        dateFrom,
      });
    }
    if (dateTo) {
      const effectiveDateTo =
        dateTo.length === 10 ? `${dateTo} 23:59:59.999` : dateTo;
      qb.andWhere('c.ngay_hoan_thanh_cong_viec <= :dateTo', {
        dateTo: effectiveDateTo,
      });
    }

    qb.groupBy("TO_CHAR(c.ngay_hoan_thanh_cong_viec, 'YYYY-MM')");
    qb.orderBy('month', 'ASC');

    const result = await qb.getRawMany();

    // 1.1 Truy vấn dòng tiền chi trả chi phí (settlement_type = 'PAYMENT') theo tháng
    const costSettlementsQb = this.settlementRepo
      .createQueryBuilder('s')
      .innerJoin(KgaraCase, 'c', 'c.id = s.case_id')
      .select("TO_CHAR(c.ngay_hoan_thanh_cong_viec, 'YYYY-MM')", 'month')
      .addSelect('SUM(s.amount)', 'totalPaidCost')
      .addSelect(
        "SUM(CASE WHEN (c.raw_data->>'TienThueKH' IS NOT NULL AND (c.raw_data->>'TienThueKH') ~ '^[0-9.]+$' AND (c.raw_data->>'TienThueKH')::numeric > 0) THEN s.amount ELSE 0 END)",
        'paidCostWithInvoice',
      )
      .addSelect(
        "SUM(CASE WHEN NOT (c.raw_data->>'TienThueKH' IS NOT NULL AND (c.raw_data->>'TienThueKH') ~ '^[0-9.]+$' AND (c.raw_data->>'TienThueKH')::numeric > 0) THEN s.amount ELSE 0 END)",
        'paidCostNoInvoice',
      )
      .where("s.settlement_type = 'PAYMENT'")
      .andWhere('c.kgara_deleted_at IS NULL')
      .andWhere('c.ngay_hoan_thanh_cong_viec IS NOT NULL');

    if (dateFrom) {
      costSettlementsQb.andWhere('c.ngay_hoan_thanh_cong_viec >= :dateFrom', {
        dateFrom,
      });
    }
    if (dateTo) {
      const effectiveDateTo =
        dateTo.length === 10 ? `${dateTo} 23:59:59.999` : dateTo;
      costSettlementsQb.andWhere('c.ngay_hoan_thanh_cong_viec <= :dateTo', {
        dateTo: effectiveDateTo,
      });
    }

    costSettlementsQb.groupBy(
      "TO_CHAR(c.ngay_hoan_thanh_cong_viec, 'YYYY-MM')",
    );
    const rawPaidCost = await costSettlementsQb.getRawMany();
    const paidCostMap = Object.fromEntries(
      rawPaidCost.map((r) => [
        r.month,
        {
          total: Number(r.totalPaidCost) || 0,
          withInvoice: Number(r.paidCostWithInvoice) || 0,
          noInvoice: Number(r.paidCostNoInvoice) || 0,
        },
      ]),
    );

    const trend = result.map((r) => {
      const rev = Number(r.revenue) || 0;
      const cost = Number(r.cost) || 0;
      const profit = Number(r.profit) || 0;
      const paid = Number(r.paid) || 0;
      const receivable = Number(r.receivable) || 0;
      const tienCoThue = Number(r.tienCoThue) || 0;
      const totalBilled =
        tienCoThue > 0
          ? tienCoThue
          : paid + receivable > 0
            ? paid + receivable
            : rev;
      const collectionRate =
        totalBilled > 0
          ? Math.min(100, Math.round((paid / totalBilled) * 1000) / 10)
          : 0;

      const paidCostInfo = paidCostMap[r.month] || {
        total: 0,
        withInvoice: 0,
        noInvoice: 0,
      };
      const paidCost = paidCostInfo.total;
      const payableCost = Math.max(0, cost - paidCost);
      const costPaymentRate =
        cost > 0
          ? Math.min(100, Math.round((paidCost / cost) * 1000) / 10)
          : 100;

      // Invoice / Non-invoice breakdowns for Receivables
      const tienCoThueWithInvoice = Number(r.tienCoThueWithInvoice) || 0;
      const tienCoThueNoInvoice = Number(r.tienCoThueNoInvoice) || 0;
      const paidWithInvoice = Number(r.paidWithInvoice) || 0;
      const paidNoInvoice = Number(r.paidNoInvoice) || 0;
      const receivableWithInvoice = Number(r.receivableWithInvoice) || 0;
      const receivableNoInvoice = Number(r.receivableNoInvoice) || 0;
      const revenueWithInvoice = Number(r.revenueWithInvoice) || 0;
      const revenueNoInvoice = Number(r.revenueNoInvoice) || 0;

      const billedWithInvoice =
        tienCoThueWithInvoice > 0
          ? tienCoThueWithInvoice
          : paidWithInvoice + receivableWithInvoice > 0
            ? paidWithInvoice + receivableWithInvoice
            : revenueWithInvoice;
      const billedNoInvoice =
        tienCoThueNoInvoice > 0
          ? tienCoThueNoInvoice
          : paidNoInvoice + receivableNoInvoice > 0
            ? paidNoInvoice + receivableNoInvoice
            : revenueNoInvoice;

      const rateWithInvoice =
        billedWithInvoice > 0
          ? Math.min(
              100,
              Math.round((paidWithInvoice / billedWithInvoice) * 1000) / 10,
            )
          : 0;
      const rateNoInvoice =
        billedNoInvoice > 0
          ? Math.min(
              100,
              Math.round((paidNoInvoice / billedNoInvoice) * 1000) / 10,
            )
          : 0;

      // Invoice / Non-invoice breakdowns for Payables
      const costWithInvoice = Number(r.costWithInvoice) || 0;
      const costNoInvoice = Number(r.costNoInvoice) || 0;
      const paidCostWithInvoice = paidCostInfo.withInvoice;
      const paidCostNoInvoice = paidCostInfo.noInvoice;
      const payableCostWithInvoice = Math.max(
        0,
        costWithInvoice - paidCostWithInvoice,
      );
      const payableCostNoInvoice = Math.max(
        0,
        costNoInvoice - paidCostNoInvoice,
      );
      const costRateWithInvoice =
        costWithInvoice > 0
          ? Math.min(
              100,
              Math.round((paidCostWithInvoice / costWithInvoice) * 1000) / 10,
            )
          : 100;
      const costRateNoInvoice =
        costNoInvoice > 0
          ? Math.min(
              100,
              Math.round((paidCostNoInvoice / costNoInvoice) * 1000) / 10,
            )
          : 100;

      return {
        label: r.month,
        revenue: rev,
        cost: cost,
        profit: profit,
        margin: rev > 0 ? (profit / rev) * 100 : 0,
        paid,
        receivable,
        tienCoThue,
        totalBilled,
        collectionRate,
        paidCost,
        payableCost,
        costPaymentRate,
        collectionRateDiff: 0,
        costPaymentRateDiff: 0,
        caseCount: Number(r.caseCount) || 0,
        // Invoice breakdowns
        caseCountWithInvoice: Number(r.caseCountWithInvoice) || 0,
        caseCountNoInvoice: Number(r.caseCountNoInvoice) || 0,
        billedWithInvoice,
        paidWithInvoice,
        receivableWithInvoice,
        rateWithInvoice,
        billedNoInvoice,
        paidNoInvoice,
        receivableNoInvoice,
        rateNoInvoice,
        costWithInvoice,
        paidCostWithInvoice,
        payableCostWithInvoice,
        costRateWithInvoice,
        costNoInvoice,
        paidCostNoInvoice,
        payableCostNoInvoice,
        costRateNoInvoice,
      };
    });

    // Tính biến động MoM (Month-over-Month) so với tháng liền kề trước đó
    for (let i = 0; i < trend.length; i++) {
      if (i > 0) {
        trend[i].collectionRateDiff =
          Math.round(
            (trend[i].collectionRate - trend[i - 1].collectionRate) * 10,
          ) / 10;
        trend[i].costPaymentRateDiff =
          Math.round(
            (trend[i].costPaymentRate - trend[i - 1].costPaymentRate) * 10,
          ) / 10;
      }
    }

    // 1.2 Tổng quan Tiến độ thu tiền Khách hàng (Collection Summary - Chỉ tính từ tháng 07/2026 như /garage-customers)
    const effectiveCollectionTrend = trend.filter((t) =>
      dateFrom ? true : t.label >= '2026-07',
    );
    const totalRevenue = effectiveCollectionTrend.reduce(
      (sum, t) => sum + t.revenue,
      0,
    );
    const totalPaid = effectiveCollectionTrend.reduce(
      (sum, t) => sum + t.paid,
      0,
    );
    const totalReceivable = effectiveCollectionTrend.reduce(
      (sum, t) => sum + t.receivable,
      0,
    );
    const totalTienCoThue = effectiveCollectionTrend.reduce(
      (sum, t) => sum + (t.tienCoThue || 0),
      0,
    );
    const totalBilled =
      totalTienCoThue > 0
        ? totalTienCoThue
        : totalPaid + totalReceivable > 0
          ? totalPaid + totalReceivable
          : totalRevenue;
    const overallCollectionRate =
      totalBilled > 0
        ? Math.min(100, Math.round((totalPaid / totalBilled) * 1000) / 10)
        : 0;

    const collectionSummary = {
      totalBilled,
      totalTienCoThue,
      totalRevenue,
      totalPaid,
      totalReceivable,
      collectionRate: overallCollectionRate,
      baselineMonth: '2026-07',
    };

    // 1.3 Tổng quan Tiến độ trả tiền Nhà cung cấp / Chi phí (Cost Payment Summary - Chỉ tính từ tháng 07/2026)
    const totalCost = effectiveCollectionTrend.reduce(
      (sum, t) => sum + t.cost,
      0,
    );
    const totalPaidCost = effectiveCollectionTrend.reduce(
      (sum, t) => sum + t.paidCost,
      0,
    );
    const totalPayableCost = Math.max(0, totalCost - totalPaidCost);
    const overallCostPaymentRate =
      totalCost > 0
        ? Math.min(100, Math.round((totalPaidCost / totalCost) * 1000) / 10)
        : 100;

    const costPaymentSummary = {
      totalCost,
      totalPaidCost,
      totalPayableCost,
      paymentRate: overallCostPaymentRate,
      baselineMonth: '2026-07',
    };

    // 1.4 Phân bổ Trạng thái Phiếu dịch vụ theo từng tháng trong 6 tháng gần nhất
    const sixMonthsAgo = format(subMonths(new Date(), 6), 'yyyy-MM-dd');
    const statusQb = this.caseRepo
      .createQueryBuilder('c')
      .select(
        "TO_CHAR(COALESCE(c.ngay_hoan_thanh_cong_viec, c.ngay_phat_sinh, c.created_at), 'YYYY-MM')",
        'month',
      )
      .addSelect('COALESCE(c.tinh_trang_dich_vu, 0)', 'statusCode')
      .addSelect(
        "COALESCE(NULLIF(c.ten_tinh_trang_dich_vu, ''), 'Khác')",
        'statusName',
      )
      .addSelect('COUNT(c.id)', 'count')
      .where('c.kgara_deleted_at IS NULL')
      .andWhere(
        'COALESCE(c.ngay_hoan_thanh_cong_viec, c.ngay_phat_sinh, c.created_at) >= :sixMonthsAgo',
        { sixMonthsAgo },
      )
      .groupBy('1, 2, 3')
      .orderBy('month', 'DESC')
      .addOrderBy('count', 'DESC');

    const rawStatus = await statusQb.getRawMany();

    const statusDistributionByMonth: Record<string, any[]> = {};
    const statusTotalByMonth: Record<string, number> = {};
    const overallStatusMap: Record<
      string,
      { statusCode: number; statusName: string; count: number }
    > = {};
    let totalStatusCount = 0;

    for (const s of rawStatus) {
      const m = s.month;
      const cnt = Number(s.count) || 0;
      const statusCode = Number(s.statusCode) || 0;
      const statusName = s.statusName;

      if (!statusDistributionByMonth[m]) {
        statusDistributionByMonth[m] = [];
        statusTotalByMonth[m] = 0;
      }
      statusDistributionByMonth[m].push({
        statusCode,
        statusName,
        count: cnt,
      });
      statusTotalByMonth[m] += cnt;

      const key = `${statusCode}_${statusName}`;
      if (!overallStatusMap[key]) {
        overallStatusMap[key] = { statusCode, statusName, count: 0 };
      }
      overallStatusMap[key].count += cnt;
      totalStatusCount += cnt;
    }

    // Tính tỷ lệ % theo từng tháng
    for (const [m, items] of Object.entries(statusDistributionByMonth)) {
      const mTotal = statusTotalByMonth[m] || 1;
      for (const item of items) {
        item.percentage =
          Math.round(((item.count as number) / mTotal) * 1000) / 10;
      }
    }

    // Tính tỷ lệ % tổng thể toàn kỳ 6 tháng
    const statusDistribution = Object.values(overallStatusMap)
      .map((s) => ({
        statusCode: s.statusCode,
        statusName: s.statusName,
        count: s.count,
        percentage:
          totalStatusCount > 0
            ? Math.round((s.count / totalStatusCount) * 1000) / 10
            : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const availableMonths = Object.keys(statusDistributionByMonth)
      .sort()
      .reverse();

    return {
      trend,
      collectionSummary,
      costPaymentSummary,
      statusDistribution,
      statusDistributionByMonth,
      availableMonths,
    };
  }

  /**
   * 2. Lấy chỉ số KPI Checkpoints (Tháng này / Tuần này / Hôm nay) kèm Sparklines theo Ngày hoàn thành
   */
  async getCheckpointKpis() {
    const now = new Date();

    // 1. Month stats & sparkline (6 months)
    const monthSparklineLabels: string[] = [];
    const monthRevenueChart: number[] = [];
    const monthCostChart: number[] = [];
    const monthProfitChart: number[] = [];
    const monthTienCoThueChart: number[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = subMonths(now, i);
      const mStart = format(startOfMonth(d), 'yyyy-MM-dd');
      const mEnd = format(endOfMonth(d), 'yyyy-MM-dd 23:59:59.999');
      monthSparklineLabels.push(`Tháng ${format(d, 'MM/yyyy')}`);

      const res = await this.caseRepo
        .createQueryBuilder('c')
        .leftJoin(
          KgaraGrossProfit,
          'gp',
          'gp.hd_phieu_dich_vu_id = c.hd_phieu_dich_vu_id OR gp.vu_viec_code = c.so_chung_tu',
        )
        .select(
          'SUM(COALESCE(gp.doanh_thu, c.doanh_thu, c.tien_co_thue, 0))',
          'revenue',
        )
        .addSelect('SUM(COALESCE(gp.chi_phi, c.chi_phi, 0))', 'cost')
        .addSelect(
          'SUM(COALESCE(gp.loi_nhuan, c.loi_nhuan, COALESCE(gp.doanh_thu, c.doanh_thu, c.tien_co_thue, 0) - COALESCE(gp.chi_phi, c.chi_phi, 0), 0))',
          'profit',
        )
        .addSelect('SUM(COALESCE(c.tien_co_thue, 0))', 'tienCoThue')
        .where('c.kgara_deleted_at IS NULL')
        .andWhere('(c.tinh_trang_dich_vu IS NULL OR c.tinh_trang_dich_vu != 9)')
        .andWhere('c.ngay_hoan_thanh_cong_viec IS NOT NULL')
        .andWhere(
          'c.ngay_hoan_thanh_cong_viec >= :mStart AND c.ngay_hoan_thanh_cong_viec <= :mEnd',
          { mStart, mEnd },
        )
        .getRawOne();

      monthRevenueChart.push(Number(res?.revenue) || 0);
      monthCostChart.push(Number(res?.cost) || 0);
      monthProfitChart.push(Number(res?.profit) || 0);
      monthTienCoThueChart.push(Number(res?.tienCoThue) || 0);
    }

    const curMonthStart = format(startOfMonth(now), 'yyyy-MM-dd');
    const curMonthEnd = format(endOfMonth(now), 'yyyy-MM-dd 23:59:59.999');
    const curMonthRes = await this.caseRepo
      .createQueryBuilder('c')
      .leftJoin(
        KgaraGrossProfit,
        'gp',
        'gp.hd_phieu_dich_vu_id = c.hd_phieu_dich_vu_id OR gp.vu_viec_code = c.so_chung_tu',
      )
      .select(
        'SUM(COALESCE(gp.doanh_thu, c.doanh_thu, c.tien_co_thue, 0))',
        'revenue',
      )
      .addSelect('SUM(COALESCE(gp.chi_phi, c.chi_phi, 0))', 'cost')
      .addSelect(
        'SUM(COALESCE(gp.loi_nhuan, c.loi_nhuan, COALESCE(gp.doanh_thu, c.doanh_thu, c.tien_co_thue, 0) - COALESCE(gp.chi_phi, c.chi_phi, 0), 0))',
        'profit',
      )
      .addSelect('SUM(COALESCE(c.tien_co_thue, 0))', 'tienCoThue')
      .addSelect('COUNT(c.id)', 'count')
      .where('c.kgara_deleted_at IS NULL')
      .andWhere('(c.tinh_trang_dich_vu IS NULL OR c.tinh_trang_dich_vu != 9)')
      .andWhere('c.ngay_hoan_thanh_cong_viec IS NOT NULL')
      .andWhere(
        'c.ngay_hoan_thanh_cong_viec >= :curMonthStart AND c.ngay_hoan_thanh_cong_viec <= :curMonthEnd',
        { curMonthStart, curMonthEnd },
      )
      .getRawOne();

    // 2. Week stats & sparkline (4 weeks)
    const weekSparklineLabels: string[] = [];
    const weekRevenueChart: number[] = [];
    const weekCostChart: number[] = [];
    const weekProfitChart: number[] = [];
    const weekTienCoThueChart: number[] = [];

    for (let i = 3; i >= 0; i--) {
      const d = subWeeks(now, i);
      const wStart = format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const wEnd = format(
        endOfWeek(d, { weekStartsOn: 1 }),
        'yyyy-MM-dd 23:59:59.999',
      );
      weekSparklineLabels.push(
        `${format(startOfWeek(d, { weekStartsOn: 1 }), 'dd/MM')} - ${format(endOfWeek(d, { weekStartsOn: 1 }), 'dd/MM')}`,
      );

      const res = await this.caseRepo
        .createQueryBuilder('c')
        .leftJoin(
          KgaraGrossProfit,
          'gp',
          'gp.hd_phieu_dich_vu_id = c.hd_phieu_dich_vu_id OR gp.vu_viec_code = c.so_chung_tu',
        )
        .select(
          'SUM(COALESCE(gp.doanh_thu, c.doanh_thu, c.tien_co_thue, 0))',
          'revenue',
        )
        .addSelect('SUM(COALESCE(gp.chi_phi, c.chi_phi, 0))', 'cost')
        .addSelect(
          'SUM(COALESCE(gp.loi_nhuan, c.loi_nhuan, COALESCE(gp.doanh_thu, c.doanh_thu, c.tien_co_thue, 0) - COALESCE(gp.chi_phi, c.chi_phi, 0), 0))',
          'profit',
        )
        .addSelect('SUM(COALESCE(c.tien_co_thue, 0))', 'tienCoThue')
        .where('c.kgara_deleted_at IS NULL')
        .andWhere('(c.tinh_trang_dich_vu IS NULL OR c.tinh_trang_dich_vu != 9)')
        .andWhere('c.ngay_hoan_thanh_cong_viec IS NOT NULL')
        .andWhere(
          'c.ngay_hoan_thanh_cong_viec >= :wStart AND c.ngay_hoan_thanh_cong_viec <= :wEnd',
          { wStart, wEnd },
        )
        .getRawOne();

      weekRevenueChart.push(Number(res?.revenue) || 0);
      weekCostChart.push(Number(res?.cost) || 0);
      weekProfitChart.push(Number(res?.profit) || 0);
      weekTienCoThueChart.push(Number(res?.tienCoThue) || 0);
    }

    const curWeekStart = format(
      startOfWeek(now, { weekStartsOn: 1 }),
      'yyyy-MM-dd',
    );
    const curWeekEnd = format(
      endOfWeek(now, { weekStartsOn: 1 }),
      'yyyy-MM-dd 23:59:59.999',
    );
    const curWeekRes = await this.caseRepo
      .createQueryBuilder('c')
      .leftJoin(
        KgaraGrossProfit,
        'gp',
        'gp.hd_phieu_dich_vu_id = c.hd_phieu_dich_vu_id OR gp.vu_viec_code = c.so_chung_tu',
      )
      .select(
        'SUM(COALESCE(gp.doanh_thu, c.doanh_thu, c.tien_co_thue, 0))',
        'revenue',
      )
      .addSelect('SUM(COALESCE(gp.chi_phi, c.chi_phi, 0))', 'cost')
      .addSelect(
        'SUM(COALESCE(gp.loi_nhuan, c.loi_nhuan, COALESCE(gp.doanh_thu, c.doanh_thu, c.tien_co_thue, 0) - COALESCE(gp.chi_phi, c.chi_phi, 0), 0))',
        'profit',
      )
      .addSelect('SUM(COALESCE(c.tien_co_thue, 0))', 'tienCoThue')
      .addSelect('COUNT(c.id)', 'count')
      .where('c.kgara_deleted_at IS NULL')
      .andWhere('(c.tinh_trang_dich_vu IS NULL OR c.tinh_trang_dich_vu != 9)')
      .andWhere('c.ngay_hoan_thanh_cong_viec IS NOT NULL')
      .andWhere(
        'c.ngay_hoan_thanh_cong_viec >= :curWeekStart AND c.ngay_hoan_thanh_cong_viec <= :curWeekEnd',
        { curWeekStart, curWeekEnd },
      )
      .getRawOne();

    // 3. Day stats & sparkline (7 days)
    const daySparklineLabels: string[] = [];
    const dayRevenueChart: number[] = [];
    const dayCostChart: number[] = [];
    const dayProfitChart: number[] = [];
    const dayTienCoThueChart: number[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = subDays(now, i);
      const dStart = format(d, 'yyyy-MM-dd');
      const dEnd = format(d, 'yyyy-MM-dd 23:59:59.999');
      daySparklineLabels.push(format(d, 'dd/MM/yyyy'));

      const res = await this.caseRepo
        .createQueryBuilder('c')
        .leftJoin(
          KgaraGrossProfit,
          'gp',
          'gp.hd_phieu_dich_vu_id = c.hd_phieu_dich_vu_id OR gp.vu_viec_code = c.so_chung_tu',
        )
        .select(
          'SUM(COALESCE(gp.doanh_thu, c.doanh_thu, c.tien_co_thue, 0))',
          'revenue',
        )
        .addSelect('SUM(COALESCE(gp.chi_phi, c.chi_phi, 0))', 'cost')
        .addSelect(
          'SUM(COALESCE(gp.loi_nhuan, c.loi_nhuan, COALESCE(gp.doanh_thu, c.doanh_thu, c.tien_co_thue, 0) - COALESCE(gp.chi_phi, c.chi_phi, 0), 0))',
          'profit',
        )
        .addSelect('SUM(COALESCE(c.tien_co_thue, 0))', 'tienCoThue')
        .where('c.kgara_deleted_at IS NULL')
        .andWhere('(c.tinh_trang_dich_vu IS NULL OR c.tinh_trang_dich_vu != 9)')
        .andWhere('c.ngay_hoan_thanh_cong_viec IS NOT NULL')
        .andWhere(
          'c.ngay_hoan_thanh_cong_viec >= :dStart AND c.ngay_hoan_thanh_cong_viec <= :dEnd',
          { dStart, dEnd },
        )
        .getRawOne();

      dayRevenueChart.push(Number(res?.revenue) || 0);
      dayCostChart.push(Number(res?.cost) || 0);
      dayProfitChart.push(Number(res?.profit) || 0);
      dayTienCoThueChart.push(Number(res?.tienCoThue) || 0);
    }

    const curDayStart = format(now, 'yyyy-MM-dd');
    const curDayEnd = format(now, 'yyyy-MM-dd 23:59:59.999');
    const curDayRes = await this.caseRepo
      .createQueryBuilder('c')
      .leftJoin(
        KgaraGrossProfit,
        'gp',
        'gp.hd_phieu_dich_vu_id = c.hd_phieu_dich_vu_id OR gp.vu_viec_code = c.so_chung_tu',
      )
      .select(
        'SUM(COALESCE(gp.doanh_thu, c.doanh_thu, c.tien_co_thue, 0))',
        'revenue',
      )
      .addSelect('SUM(COALESCE(gp.chi_phi, c.chi_phi, 0))', 'cost')
      .addSelect(
        'SUM(COALESCE(gp.loi_nhuan, c.loi_nhuan, COALESCE(gp.doanh_thu, c.doanh_thu, c.tien_co_thue, 0) - COALESCE(gp.chi_phi, c.chi_phi, 0), 0))',
        'profit',
      )
      .addSelect('SUM(COALESCE(c.tien_co_thue, 0))', 'tienCoThue')
      .addSelect('COUNT(c.id)', 'count')
      .where('c.kgara_deleted_at IS NULL')
      .andWhere('(c.tinh_trang_dich_vu IS NULL OR c.tinh_trang_dich_vu != 9)')
      .andWhere('c.ngay_hoan_thanh_cong_viec IS NOT NULL')
      .andWhere(
        'c.ngay_hoan_thanh_cong_viec >= :curDayStart AND c.ngay_hoan_thanh_cong_viec <= :curDayEnd',
        { curDayStart, curDayEnd },
      )
      .getRawOne();

    return {
      month: {
        totalRevenue: Number(curMonthRes?.revenue) || 0,
        totalCost: Number(curMonthRes?.cost) || 0,
        totalProfit: Number(curMonthRes?.profit) || 0,
        totalTienCoThue: Number(curMonthRes?.tienCoThue) || 0,
        totalCount: Number(curMonthRes?.count) || 0,
        revenueChart: monthRevenueChart,
        costChart: monthCostChart,
        profitChart: monthProfitChart,
        tienCoThueChart: monthTienCoThueChart,
        labels: monthSparklineLabels,
      },
      week: {
        totalRevenue: Number(curWeekRes?.revenue) || 0,
        totalCost: Number(curWeekRes?.cost) || 0,
        totalProfit: Number(curWeekRes?.profit) || 0,
        totalTienCoThue: Number(curWeekRes?.tienCoThue) || 0,
        totalCount: Number(curWeekRes?.count) || 0,
        revenueChart: weekRevenueChart,
        costChart: weekCostChart,
        profitChart: weekProfitChart,
        tienCoThueChart: weekTienCoThueChart,
        labels: weekSparklineLabels,
      },
      day: {
        totalRevenue: Number(curDayRes?.revenue) || 0,
        totalCost: Number(curDayRes?.cost) || 0,
        totalProfit: Number(curDayRes?.profit) || 0,
        totalTienCoThue: Number(curDayRes?.tienCoThue) || 0,
        totalCount: Number(curDayRes?.count) || 0,
        revenueChart: dayRevenueChart,
        costChart: dayCostChart,
        profitChart: dayProfitChart,
        tienCoThueChart: dayTienCoThueChart,
        labels: daySparklineLabels,
      },
    };
  }

  /**
   * 3. Lấy danh sách vụ việc trong khoảng thời gian checkpoint (click sparkline)
   * Sửa lỗi TypeORM 500 ("COALESCE(c" alias not found) bằng cách dùng direct column orderBy('c.ngayHoanThanhCongViec', 'DESC')
   */
  async getCheckpointCases(
    dateFrom: string,
    dateTo: string,
    page: number = 1,
    pageSize: number = 20,
  ) {
    const effectiveDateTo =
      dateTo.length === 10 ? `${dateTo} 23:59:59.999` : dateTo;

    const qb = this.caseRepo
      .createQueryBuilder('c')
      .leftJoinAndMapOne(
        'c.grossProfit',
        KgaraGrossProfit,
        'gp',
        'gp.hd_phieu_dich_vu_id = c.hd_phieu_dich_vu_id OR gp.vu_viec_code = c.so_chung_tu',
      )
      .where('c.kgara_deleted_at IS NULL')
      .andWhere('(c.tinh_trang_dich_vu IS NULL OR c.tinh_trang_dich_vu != 9)')
      .andWhere('c.ngay_hoan_thanh_cong_viec IS NOT NULL')
      .andWhere('c.ngay_hoan_thanh_cong_viec >= :dateFrom', {
        dateFrom,
      })
      .andWhere('c.ngay_hoan_thanh_cong_viec <= :dateTo', {
        dateTo: effectiveDateTo,
      })
      .orderBy('c.ngayHoanThanhCongViec', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();

    return {
      items: items.map((c: any) => {
        const gp = c.grossProfit;
        const rev = Number(gp?.doanhThu ?? c.doanhThu ?? c.tienCoThue ?? 0);
        const cost = Number(gp?.chiPhi ?? c.chiPhi ?? 0);
        const profit = Number(gp?.loiNhuan ?? c.loiNhuan ?? rev - cost);

        return {
          id: c.id,
          soChungTu: c.soChungTu,
          bienSoXe: c.bienSoXe,
          khachHangCode: c.khachHangCode,
          khachHangName: c.khachHangName,
          tenTinhTrangDichVu: c.tenTinhTrangDichVu,
          doanhThu: rev,
          chiPhi: cost,
          loiNhuan: profit,
          tienDaThanhToan: Number(c.tienDaThanhToan ?? 0),
          tienConPhaiThanhToan: Number(c.tienConPhaiThanhToan ?? 0),
          ngayHoanThanhCongViec: c.ngayHoanThanhCongViec,
          ngayPhatSinh: c.ngayPhatSinh || c.createdAt,
        };
      }),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * 4. Lấy danh sách khách hàng và công nợ (Customer Stats & Debt) theo Ngày hoàn thành
   */
  async getCustomersStats(
    page: number = 1,
    pageSize: number = 20,
    search?: string,
    dateFrom?: string,
    dateTo?: string,
    sortBy?: string,
    sortOrder?: 'ASC' | 'DESC',
    columnSearch?: string,
    columnFilters?: string,
  ) {
    const customerQuery = `
      SELECT 
        COALESCE(NULLIF(c.khach_hang_code, ''), NULLIF(c.khach_hang_name, ''), 'KH_LE') as "customerCode",
        MAX(c.khach_hang_name) as "customerName",
        MAX(c.bien_so_xe) as "latestLicensePlate",
        SUM(COALESCE(gp.doanh_thu, c.doanh_thu, c.tien_co_thue, 0)) as "totalRevenue",
        SUM(COALESCE(gp.chi_phi, c.chi_phi, 0)) as "totalCost",
        SUM(COALESCE(gp.loi_nhuan, c.loi_nhuan, COALESCE(gp.doanh_thu, c.doanh_thu, c.tien_co_thue, 0) - COALESCE(gp.chi_phi, c.chi_phi, 0), 0)) as "totalProfit",
        SUM(COALESCE(c.tien_da_thanh_toan, 0)) as "paidAmount",
        SUM(COALESCE(c.tien_con_phai_thanh_toan, 0)) as "receivableAmount",
        COUNT(c.id) as "caseCount",
        MAX(c.ngay_hoan_thanh_cong_viec) as "lastVisitDate"
      FROM kgara_cases c
      LEFT JOIN kgara_gross_profit gp ON gp.hd_phieu_dich_vu_id = c.hd_phieu_dich_vu_id OR gp.vu_viec_code = c.so_chung_tu
      WHERE c.kgara_deleted_at IS NULL 
        AND (c.tinh_trang_dich_vu IS NULL OR c.tinh_trang_dich_vu != 9)
        AND c.ngay_hoan_thanh_cong_viec IS NOT NULL
        ${dateFrom ? `AND c.ngay_hoan_thanh_cong_viec >= '${dateFrom}'` : ''}
        ${dateTo ? `AND c.ngay_hoan_thanh_cong_viec <= '${dateTo.length === 10 ? dateTo + ' 23:59:59.999' : dateTo}'` : ''}
      GROUP BY COALESCE(NULLIF(c.khach_hang_code, ''), NULLIF(c.khach_hang_name, ''), 'KH_LE')
      HAVING COALESCE(NULLIF(c.khach_hang_code, ''), NULLIF(c.khach_hang_name, ''), 'KH_LE') IS NOT NULL
    `;

    let finalQuery = `SELECT * FROM (${customerQuery}) cust`;
    const whereConditions: string[] = [];

    if (search) {
      const s = search.replace(/'/g, "''");
      whereConditions.push(
        `(cust."customerCode" ILIKE '%${s}%' OR cust."customerName" ILIKE '%${s}%' OR cust."latestLicensePlate" ILIKE '%${s}%')`,
      );
    }

    if (columnSearch) {
      try {
        const cSearch = JSON.parse(columnSearch) as Record<string, string>;
        for (const [col, val] of Object.entries(cSearch)) {
          if (!val) continue;
          const s = val.replace(/'/g, "''");
          if (col === 'customerCode') {
            whereConditions.push(`cust."customerCode" ILIKE '%${s}%'`);
          } else if (col === 'customerName') {
            whereConditions.push(`cust."customerName" ILIKE '%${s}%'`);
          } else if (col === 'latestLicensePlate') {
            whereConditions.push(`cust."latestLicensePlate" ILIKE '%${s}%'`);
          }
        }
      } catch (e) {}
    }

    if (columnFilters) {
      try {
        const cFilters = JSON.parse(columnFilters) as Record<string, string[]>;
        for (const [col, vals] of Object.entries(cFilters)) {
          if (!vals || vals.length === 0) continue;
          const quotedVals = vals
            .map((v) => `'${v.replace(/'/g, "''")}'`)
            .join(', ');
          if (col === 'customerCode') {
            whereConditions.push(`cust."customerCode" IN (${quotedVals})`);
          } else if (col === 'customerName') {
            whereConditions.push(`cust."customerName" IN (${quotedVals})`);
          }
        }
      } catch (e) {}
    }

    if (sortBy === 'receivableAmount') {
      whereConditions.push(`cust."receivableAmount" > 0`);
    }

    if (whereConditions.length > 0) {
      finalQuery += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    const countQuery = `SELECT COUNT(*) as count FROM (${finalQuery}) as t`;
    const countResult = await this.caseRepo.query(countQuery);
    const total = parseInt(countResult[0]?.count || '0', 10);

    let orderClause = `ORDER BY cust."totalRevenue" DESC`;
    if (sortBy === 'receivableAmount') {
      orderClause = `ORDER BY cust."receivableAmount" ${sortOrder || 'DESC'}`;
    } else if (sortBy === 'lastVisitDate') {
      orderClause = `ORDER BY cust."lastVisitDate" ${sortOrder || 'DESC'}`;
    } else if (sortBy) {
      orderClause = `ORDER BY cust."${sortBy}" ${sortOrder || 'DESC'}`;
    }

    const dataQuery = `${finalQuery} ${orderClause} LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`;
    const rawData = await this.caseRepo.query(dataQuery);

    const items = rawData.map((r: any) => {
      const rev = Number(r.totalRevenue) || 0;
      const cost = Number(r.totalCost) || 0;
      const profit = Number(r.totalProfit) || 0;
      const paid = Number(r.paidAmount) || 0;
      const receivable = Number(r.receivableAmount) || 0;

      return {
        customerCode: r.customerCode,
        customerName: r.customerName || 'Khách lẻ',
        latestLicensePlate: r.latestLicensePlate || '-',
        totalRevenue: rev,
        totalCost: cost,
        totalGrossProfit: profit,
        margin: rev > 0 ? (profit / rev) * 100 : 0,
        paidAmount: paid,
        receivableAmount: receivable,
        caseCount: Number(r.caseCount) || 0,
        lastVisitDate: r.lastVisitDate,
      };
    });

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * 5. Xuất báo cáo Excel chuyên nghiệp đa bảng (Multi-sheet Export) theo Ngày hoàn thành
   */
  async exportExcel(dateFrom?: string, dateTo?: string): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();

    // Sheet 1: Tổng quan Xu hướng Tháng
    const stats = await this.getDashboardStats(dateFrom, dateTo);
    const sheet1 = workbook.addWorksheet('Tổng quan Tháng');
    sheet1.views = [{ state: 'frozen', ySplit: 1 }];
    sheet1.autoFilter = 'A1:L1';
    sheet1.columns = [
      { header: 'Tháng', key: 'month', width: 15 },
      {
        header: 'Doanh thu (VND)',
        key: 'revenue',
        width: 20,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Giá vốn (VND)',
        key: 'cost',
        width: 20,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Lợi nhuận gộp (VND)',
        key: 'profit',
        width: 22,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Biên LN (%)',
        key: 'margin',
        width: 15,
        style: { numFmt: '0.0"%"' },
      },
      {
        header: 'Đã thu (VND)',
        key: 'paid',
        width: 20,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Còn phải thu (VND)',
        key: 'receivable',
        width: 20,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Tỷ lệ thu (%)',
        key: 'collectionRate',
        width: 15,
        style: { numFmt: '0.0"%"' },
      },
      {
        header: 'Đã chi trả CP (VND)',
        key: 'paidCost',
        width: 20,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Còn nợ NCC (VND)',
        key: 'payableCost',
        width: 20,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Tỷ lệ chi (%)',
        key: 'costPaymentRate',
        width: 15,
        style: { numFmt: '0.0"%"' },
      },
      { header: 'Số vụ việc', key: 'caseCount', width: 15 },
    ];

    stats.trend.forEach((t) => {
      sheet1.addRow({
        month: t.label,
        revenue: t.revenue,
        cost: t.cost,
        profit: t.profit,
        margin: t.margin,
        paid: t.paid,
        receivable: t.receivable,
        collectionRate: t.collectionRate,
        paidCost: t.paidCost,
        payableCost: t.payableCost,
        costPaymentRate: t.costPaymentRate,
        caseCount: t.caseCount,
      });
    });

    // Sheet 2: Chi tiết Phiếu Dịch Vụ
    const casesQb = this.caseRepo
      .createQueryBuilder('c')
      .leftJoinAndMapOne(
        'c.grossProfit',
        KgaraGrossProfit,
        'gp',
        'gp.hd_phieu_dich_vu_id = c.hd_phieu_dich_vu_id OR gp.vu_viec_code = c.so_chung_tu',
      )
      .where('c.kgara_deleted_at IS NULL')
      .andWhere('(c.tinh_trang_dich_vu IS NULL OR c.tinh_trang_dich_vu != 9)')
      .andWhere('c.ngay_hoan_thanh_cong_viec IS NOT NULL');

    if (dateFrom) {
      casesQb.andWhere('c.ngay_hoan_thanh_cong_viec >= :dateFrom', {
        dateFrom,
      });
    }
    if (dateTo) {
      const effectiveDateTo =
        dateTo.length === 10 ? `${dateTo} 23:59:59.999` : dateTo;
      casesQb.andWhere('c.ngay_hoan_thanh_cong_viec <= :dateTo', {
        dateTo: effectiveDateTo,
      });
    }

    casesQb.orderBy('c.ngayHoanThanhCongViec', 'DESC');
    const cases = await casesQb.getMany();

    const sheet2 = workbook.addWorksheet('Chi tiết Phiếu dịch vụ');
    sheet2.views = [{ state: 'frozen', ySplit: 1 }];
    sheet2.autoFilter = 'A1:L1';
    sheet2.columns = [
      { header: 'Ngày hoàn thành', key: 'ngayHoanThanhCongViec', width: 18 },
      { header: 'Ngày phát sinh', key: 'ngayPhatSinh', width: 16 },
      { header: 'Số chứng từ', key: 'soChungTu', width: 18 },
      { header: 'Biển số xe', key: 'bienSoXe', width: 15 },
      { header: 'Mã khách hàng', key: 'khachHangCode', width: 18 },
      { header: 'Tên khách hàng', key: 'khachHangName', width: 30 },
      { header: 'Trạng thái dịch vụ', key: 'tenTinhTrangDichVu', width: 20 },
      {
        header: 'Doanh thu (VND)',
        key: 'doanhThu',
        width: 20,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Giá vốn (VND)',
        key: 'chiPhi',
        width: 20,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Lãi gộp (VND)',
        key: 'loiNhuan',
        width: 20,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Đã trả (VND)',
        key: 'tienDaThanhToan',
        width: 20,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Còn nợ (VND)',
        key: 'tienConPhaiThanhToan',
        width: 20,
        style: { numFmt: '#,##0.00' },
      },
    ];

    cases.forEach((c: any) => {
      const dtComplete = c.ngayHoanThanhCongViec;
      const dt = c.ngayPhatSinh || c.createdAt;
      const gp = c.grossProfit;
      const rev = Number(gp?.doanhThu ?? c.doanhThu ?? c.tienCoThue ?? 0);
      const cost = Number(gp?.chiPhi ?? c.chiPhi ?? 0);
      const profit = Number(gp?.loiNhuan ?? c.loiNhuan ?? rev - cost);

      sheet2.addRow({
        ngayHoanThanhCongViec: dtComplete
          ? format(new Date(dtComplete), 'yyyy-MM-dd')
          : '',
        ngayPhatSinh: dt ? format(new Date(dt), 'yyyy-MM-dd') : '',
        soChungTu: c.soChungTu || '',
        bienSoXe: c.bienSoXe || '',
        khachHangCode: c.khachHangCode || '',
        khachHangName: c.khachHangName || '',
        tenTinhTrangDichVu: c.tenTinhTrangDichVu || '',
        doanhThu: rev,
        chiPhi: cost,
        loiNhuan: profit,
        tienDaThanhToan: Number(c.tienDaThanhToan ?? 0),
        tienConPhaiThanhToan: Number(c.tienConPhaiThanhToan ?? 0),
      });
    });

    // Định dạng tiêu đề cho tất cả worksheet
    workbook.worksheets.forEach((s) => {
      s.getRow(1).font = { bold: true };
      s.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };
      s.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as unknown as Buffer;
  }

  /**
   * 6. Lấy Báo cáo Lợi nhuận (P&L) Garage theo tháng (Doanh thu + Giá vốn + CP vận hành + Hoa hồng -> Lợi nhuận ròng)
   */
  async getPnlReport(year?: number, month?: number) {
    const currentYear = year ? Number(year) : new Date().getFullYear();
    const currentMonth = month ? Number(month) : new Date().getMonth() + 1;
    const periodStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

    // 1. Tổng hợp Doanh thu & Chi phí giá vốn từ các vụ việc hoàn thành trong tháng
    const qb = this.caseRepo
      .createQueryBuilder('c')
      .leftJoin(
        KgaraGrossProfit,
        'gp',
        'gp.hd_phieu_dich_vu_id = c.hd_phieu_dich_vu_id OR gp.vu_viec_code = c.so_chung_tu',
      )
      .select(
        'SUM(COALESCE(gp.doanh_thu, c.doanh_thu, c.tien_co_thue, 0))',
        'revenue',
      )
      .addSelect('SUM(COALESCE(gp.chi_phi, c.chi_phi, 0))', 'cogs')
      .addSelect('COUNT(c.id)', 'caseCount')
      .where('c.kgara_deleted_at IS NULL')
      .andWhere('(c.tinh_trang_dich_vu IS NULL OR c.tinh_trang_dich_vu != 9)')
      .andWhere('c.ngay_hoan_thanh_cong_viec IS NOT NULL')
      .andWhere(
        "TO_CHAR(c.ngay_hoan_thanh_cong_viec, 'YYYY-MM') = :periodStr",
        { periodStr },
      );

    const rawAgg = await qb.getRawOne();
    const revenue = Number(rawAgg?.revenue) || 0;
    const cogsDirect = Number(rawAgg?.cogs) || 0;
    const caseCount = Number(rawAgg?.caseCount) || 0;

    // 2. Lấy Chi phí vận hành, Hoa hồng & Chi phí trực tiếp nhập tay từ GarageOpexService
    const opexSummary = await this.opexService.getSummaryByPeriod(
      currentYear,
      currentMonth,
    );

    const cogs = cogsDirect + opexSummary.directCost.total;
    const grossProfit = revenue - cogs;

    const netProfitBeforeCommission = grossProfit - opexSummary.opex.total;
    const netProfitAfterCommission =
      netProfitBeforeCommission - opexSummary.commission.total;

    return {
      period: { year: currentYear, month: currentMonth },
      periodStr: `${String(currentMonth).padStart(2, '0')}/${currentYear}`,
      caseCount,
      revenue,
      cogs,
      cogsDirect,
      cogsAdjustment: opexSummary.directCost,
      grossProfit,
      grossMarginRate: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
      opex: opexSummary.opex,
      netProfitBeforeCommission,
      commission: opexSummary.commission,
      netProfitAfterCommission,
      netMarginRate:
        revenue > 0 ? (netProfitAfterCommission / revenue) * 100 : 0,
    };
  }

  /**
   * 7. Xuất Báo cáo Lợi nhuận (P&L) ra file Excel
   */
  async exportPnlExcel(year?: number, month?: number): Promise<Buffer> {
    const report = await this.getPnlReport(year, month);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Liouni ERP';
    workbook.lastModifiedBy = 'Liouni ERP';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(
      `P&L Tháng ${report.period.month}-${report.period.year}`,
    );

    sheet.columns = [
      { header: 'Danh Mục', key: 'category', width: 45 },
      {
        header: 'Giá Trị (VND)',
        key: 'amount',
        width: 25,
        style: { numFmt: '#,##0' },
      },
    ];

    // Tiêu đề lớn
    sheet.spliceRows(1, 0, [
      `BÁO CÁO LỢI NHUẬN (P&L) GARAGE - THÁNG ${String(report.period.month).padStart(2, '0')}/${report.period.year}`,
      '',
    ]);
    sheet.mergeCells('A1:B1');
    const titleRow = sheet.getRow(1);
    titleRow.font = {
      name: 'Arial',
      size: 14,
      bold: true,
      color: { argb: 'FF1E293B' },
    };
    titleRow.alignment = { horizontal: 'center', vertical: 'middle' };
    titleRow.height = 30;

    // Header bảng
    const headerRow = sheet.getRow(2);
    headerRow.font = {
      name: 'Arial',
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF334155' },
    };
    headerRow.height = 24;

    const rowsData: Array<{
      category: string;
      amount: number | string;
      isHeader?: boolean;
      isHighlight?: boolean;
      isSuccess?: boolean;
      isChild?: boolean;
    }> = [
      { category: 'I. Doanh Thu', amount: report.revenue, isHeader: true },
      {
        category: '   Doanh Thu Dịch Vụ',
        amount: report.revenue,
        isChild: true,
      },
      {
        category: 'II. Chi phí (Giá vốn)',
        amount: report.cogs,
        isHeader: true,
      },
      {
        category: '   Chi phí phụ tùng & Gia công ngoài',
        amount: report.cogsDirect,
        isChild: true,
      },
    ];

    if (report.cogsAdjustment && report.cogsAdjustment.items.length > 0) {
      for (const item of report.cogsAdjustment.items) {
        rowsData.push({
          category: `   ${item.categoryName}`,
          amount: item.amount,
          isChild: true,
        });
      }
    }

    rowsData.push(
      {
        category: 'III. Lợi nhuận gộp',
        amount: report.grossProfit,
        isHighlight: true,
      },
      {
        category: 'IV. Chi phí vận hành',
        amount: report.opex.total,
        isHeader: true,
      },
    );

    if (report.opex.items.length === 0) {
      rowsData.push({
        category: '   (Chưa nhập chi phí vận hành)',
        amount: 0,
        isChild: true,
      });
    } else {
      for (const item of report.opex.items) {
        rowsData.push({
          category: `   ${item.categoryName}`,
          amount: item.amount,
          isChild: true,
        });
      }
    }

    rowsData.push({
      category: 'V. Lợi nhuận ròng (trước hoa hồng)',
      amount: report.netProfitBeforeCommission,
      isHighlight: true,
    });

    rowsData.push({
      category: 'VI. Hoa hồng',
      amount: report.commission.total,
      isHeader: true,
    });

    if (report.commission.items.length === 0) {
      rowsData.push({
        category: '   (Chưa nhập hoa hồng)',
        amount: 0,
        isChild: true,
      });
    } else {
      for (const item of report.commission.items) {
        rowsData.push({
          category: `   ${item.categoryName}`,
          amount: item.amount,
          isChild: true,
        });
      }
    }

    rowsData.push({
      category: 'VII. Lợi nhuận ròng (sau hoa hồng)',
      amount: report.netProfitAfterCommission,
      isSuccess: true,
    });

    for (const r of rowsData) {
      const addedRow = sheet.addRow({
        category: r.category,
        amount: typeof r.amount === 'number' ? r.amount : 0,
      });
      addedRow.height = 22;

      if (r.isHeader) {
        addedRow.font = { bold: true, color: { argb: 'FF0F172A' } };
        addedRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF1F5F9' },
        };
      } else if (r.isHighlight) {
        addedRow.font = { bold: true, color: { argb: 'FF1E3A8A' } };
        addedRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFDBEAFE' },
        };
      } else if (r.isSuccess) {
        addedRow.font = { bold: true, size: 12, color: { argb: 'FF14532D' } };
        addedRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFDCFCE7' },
        };
      } else if (r.isChild) {
        addedRow.font = { color: { argb: 'FF475569' } };
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as unknown as Buffer;
  }
}
