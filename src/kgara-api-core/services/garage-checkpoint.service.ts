import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KgaraCase } from '../entities/kgara_case.entity';
import { KgaraGrossProfit } from '../entities/kgara_gross_profit.entity';
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
export class GarageCheckpointService {
  private readonly logger = new Logger(GarageCheckpointService.name);

  constructor(
    @InjectRepository(KgaraCase)
    private readonly caseRepo: Repository<KgaraCase>,
  ) {}

  /**
   * 2. Lấy chỉ số KPI Checkpoints (Tháng này / Tuần này / Hôm nay) kèm Sparklines theo Ngày hoàn thành & Dự thu Pipeline xe đang làm
   */
  async getCheckpointKpis() {
    const now = new Date();

    // 1. Month stats & sparkline (6 months)
    const monthSparklineLabels: string[] = [];
    const monthRevenueChart: number[] = [];
    const monthCostChart: number[] = [];
    const monthProfitChart: number[] = [];
    const monthTienCoThueChart: number[] = [];
    const monthPaidChart: number[] = [];
    const monthReceivableChart: number[] = [];

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
        .addSelect('SUM(COALESCE(c.tien_da_thanh_toan, 0))', 'paid')
        .addSelect('SUM(COALESCE(c.tien_con_phai_thanh_toan, 0))', 'receivable')
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
      monthPaidChart.push(Number(res?.paid) || 0);
      monthReceivableChart.push(Number(res?.receivable) || 0);
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
      .addSelect('SUM(COALESCE(c.tien_da_thanh_toan, 0))', 'paid')
      .addSelect('SUM(COALESCE(c.tien_con_phai_thanh_toan, 0))', 'receivable')
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
    const weekPaidChart: number[] = [];
    const weekReceivableChart: number[] = [];

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
        .addSelect('SUM(COALESCE(c.tien_da_thanh_toan, 0))', 'paid')
        .addSelect('SUM(COALESCE(c.tien_con_phai_thanh_toan, 0))', 'receivable')
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
      weekPaidChart.push(Number(res?.paid) || 0);
      weekReceivableChart.push(Number(res?.receivable) || 0);
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
      .addSelect('SUM(COALESCE(c.tien_da_thanh_toan, 0))', 'paid')
      .addSelect('SUM(COALESCE(c.tien_con_phai_thanh_toan, 0))', 'receivable')
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
    const dayPaidChart: number[] = [];
    const dayReceivableChart: number[] = [];

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
        .addSelect('SUM(COALESCE(c.tien_da_thanh_toan, 0))', 'paid')
        .addSelect('SUM(COALESCE(c.tien_con_phai_thanh_toan, 0))', 'receivable')
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
      dayPaidChart.push(Number(res?.paid) || 0);
      dayReceivableChart.push(Number(res?.receivable) || 0);
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
      .addSelect('SUM(COALESCE(c.tien_da_thanh_toan, 0))', 'paid')
      .addSelect('SUM(COALESCE(c.tien_con_phai_thanh_toan, 0))', 'receivable')
      .addSelect('COUNT(c.id)', 'count')
      .where('c.kgara_deleted_at IS NULL')
      .andWhere('(c.tinh_trang_dich_vu IS NULL OR c.tinh_trang_dich_vu != 9)')
      .andWhere('c.ngay_hoan_thanh_cong_viec IS NOT NULL')
      .andWhere(
        'c.ngay_hoan_thanh_cong_viec >= :curDayStart AND c.ngay_hoan_thanh_cong_viec <= :curDayEnd',
        { curDayStart, curDayEnd },
      )
      .getRawOne();

    // 4. Dự thu & Pipeline xe đang làm (Chưa có ngày hoàn thành, không bị hủy)
    const inProgressCasesQb = this.caseRepo
      .createQueryBuilder('c')
      .select(
        `CASE 
          WHEN c.classification = 'SUA_CHUA_CHUNG' THEN 'SUA_CHUA_CHUNG'
          WHEN c.classification IN ('KY_GUI_NOI_BO', 'KY_GUI', 'NOI_BO') THEN 'KY_GUI_NOI_BO'
          WHEN c.classification IN ('OJ', 'OJ_NGOAI') THEN 'OJ_NGOAI'
          ELSE 'KHAC'
        END`,
        'classificationKey',
      )
      .addSelect('COUNT(c.id)', 'count')
      .addSelect('SUM(COALESCE(c.tien_co_thue, 0))', 'amount')
      .where('c.kgara_deleted_at IS NULL')
      .andWhere('(c.tinh_trang_dich_vu IS NULL OR c.tinh_trang_dich_vu != 9)')
      .andWhere('c.ngay_hoan_thanh_cong_viec IS NULL');

    // Pipeline tháng này (tất cả xe đang làm)
    const inProgressMonthRaw = await inProgressCasesQb
      .clone()
      .groupBy('1')
      .getRawMany();

    // Pipeline hôm nay (xe đang làm phát sinh trong ngày)
    const inProgressTodayRaw = await inProgressCasesQb
      .clone()
      .andWhere(
        'COALESCE(c.ngay_phat_sinh, c.created_at) >= :curDayStart AND COALESCE(c.ngay_phat_sinh, c.created_at) <= :curDayEnd',
        { curDayStart, curDayEnd },
      )
      .groupBy('1')
      .getRawMany();

    const formatPipeline = (rawItems: any[]) => {
      let totalCount = 0;
      let totalAmount = 0;
      const byClassification: Record<
        string,
        { name: string; count: number; amount: number }
      > = {
        SUA_CHUA_CHUNG: { name: 'Sửa chữa chung', count: 0, amount: 0 },
        KY_GUI_NOI_BO: { name: 'Ký gửi / Nội bộ', count: 0, amount: 0 },
        OJ_NGOAI: { name: 'OJ Ngoài', count: 0, amount: 0 },
        KHAC: { name: 'Khác', count: 0, amount: 0 },
      };

      for (const item of rawItems) {
        const key = item.classificationKey || 'KHAC';
        const cnt = Number(item.count) || 0;
        const amt = Number(item.amount) || 0;
        totalCount += cnt;
        totalAmount += amt;
        if (byClassification[key]) {
          byClassification[key].count += cnt;
          byClassification[key].amount += amt;
        }
      }

      return {
        totalCount,
        totalAmount,
        byClassification,
      };
    };

    const projectedToday = formatPipeline(inProgressTodayRaw);
    const projectedMonth = formatPipeline(inProgressMonthRaw);

    const mTotalBilled = Number(curMonthRes?.tienCoThue) || 0;
    const mTotalPaid = Number(curMonthRes?.paid) || 0;
    const mTotalReceivable = Number(curMonthRes?.receivable) || 0;
    const mCollectionRate =
      mTotalBilled > 0
        ? Math.round((mTotalPaid / mTotalBilled) * 1000) / 10
        : 0;

    const wTotalBilled = Number(curWeekRes?.tienCoThue) || 0;
    const wTotalPaid = Number(curWeekRes?.paid) || 0;
    const wTotalReceivable = Number(curWeekRes?.receivable) || 0;
    const wCollectionRate =
      wTotalBilled > 0
        ? Math.round((wTotalPaid / wTotalBilled) * 1000) / 10
        : 0;

    const dTotalBilled = Number(curDayRes?.tienCoThue) || 0;
    const dTotalPaid = Number(curDayRes?.paid) || 0;
    const dTotalReceivable = Number(curDayRes?.receivable) || 0;
    const dCollectionRate =
      dTotalBilled > 0
        ? Math.round((dTotalPaid / dTotalBilled) * 1000) / 10
        : 0;

    return {
      month: {
        totalRevenue: Number(curMonthRes?.revenue) || 0,
        totalCost: Number(curMonthRes?.cost) || 0,
        totalProfit: Number(curMonthRes?.profit) || 0,
        totalTienCoThue: mTotalBilled,
        totalPaid: mTotalPaid,
        totalReceivable: mTotalReceivable,
        collectionRate: mCollectionRate,
        totalCount: Number(curMonthRes?.count) || 0,
        revenueChart: monthRevenueChart,
        costChart: monthCostChart,
        profitChart: monthProfitChart,
        tienCoThueChart: monthTienCoThueChart,
        paidChart: monthPaidChart,
        receivableChart: monthReceivableChart,
        labels: monthSparklineLabels,
      },
      week: {
        totalRevenue: Number(curWeekRes?.revenue) || 0,
        totalCost: Number(curWeekRes?.cost) || 0,
        totalProfit: Number(curWeekRes?.profit) || 0,
        totalTienCoThue: wTotalBilled,
        totalPaid: wTotalPaid,
        totalReceivable: wTotalReceivable,
        collectionRate: wCollectionRate,
        totalCount: Number(curWeekRes?.count) || 0,
        revenueChart: weekRevenueChart,
        costChart: weekCostChart,
        profitChart: weekProfitChart,
        tienCoThueChart: weekTienCoThueChart,
        paidChart: weekPaidChart,
        receivableChart: weekReceivableChart,
        labels: weekSparklineLabels,
      },
      day: {
        totalRevenue: Number(curDayRes?.revenue) || 0,
        totalCost: Number(curDayRes?.cost) || 0,
        totalProfit: Number(curDayRes?.profit) || 0,
        totalTienCoThue: dTotalBilled,
        totalPaid: dTotalPaid,
        totalReceivable: dTotalReceivable,
        collectionRate: dCollectionRate,
        totalCount: Number(curDayRes?.count) || 0,
        revenueChart: dayRevenueChart,
        costChart: dayCostChart,
        profitChart: dayProfitChart,
        tienCoThueChart: dayTienCoThueChart,
        paidChart: dayPaidChart,
        receivableChart: dayReceivableChart,
        labels: daySparklineLabels,
      },
      projectedToday,
      projectedMonth,
    };
  }

  /**
   * 3. Lấy danh sách vụ việc trong khoảng thời gian checkpoint (click sparkline / mở drawer)
   * Kèm summary toàn kỳ (tổng phải thu, đã thu, còn nợ, % hoàn tất, phân loại ERP) và bộ lọc search/tiến độ nợ
   */
  async getCheckpointCases(
    dateFrom: string,
    dateTo: string,
    page: number = 1,
    pageSize: number = 20,
    search?: string,
    paymentStatus?: 'all' | 'remaining' | 'paid' | 'unpaid',
    classification?: string,
    sortBy: string = 'ngayHoanThanhCongViec',
    sortOrder: 'ASC' | 'DESC' = 'DESC',
  ) {
    const effectiveDateTo =
      dateTo.length === 10 ? `${dateTo} 23:59:59.999` : dateTo;

    // 3.1 Truy vấn Summary Toàn Kỳ (Không bị phân trang)
    const summaryRaw = await this.caseRepo
      .createQueryBuilder('c')
      .leftJoin(
        KgaraGrossProfit,
        'gp',
        'gp.hd_phieu_dich_vu_id = c.hd_phieu_dich_vu_id OR gp.vu_viec_code = c.so_chung_tu',
      )
      .select('COUNT(c.id)', 'totalCount')
      .addSelect('SUM(COALESCE(c.tien_co_thue, 0))', 'totalTienCoThue')
      .addSelect(
        'SUM(COALESCE(gp.doanh_thu, c.doanh_thu, c.tien_co_thue, 0))',
        'totalRevenue',
      )
      .addSelect('SUM(COALESCE(gp.chi_phi, c.chi_phi, 0))', 'totalCost')
      .addSelect(
        'SUM(COALESCE(gp.loi_nhuan, c.loi_nhuan, COALESCE(gp.doanh_thu, c.doanh_thu, c.tien_co_thue, 0) - COALESCE(gp.chi_phi, c.chi_phi, 0), 0))',
        'totalProfit',
      )
      .addSelect('SUM(COALESCE(c.tien_da_thanh_toan, 0))', 'totalPaid')
      .addSelect(
        'SUM(COALESCE(c.tien_con_phai_thanh_toan, 0))',
        'totalRemaining',
      )
      .addSelect(
        'COUNT(CASE WHEN COALESCE(c.tien_con_phai_thanh_toan, 0) <= 0 AND COALESCE(c.tien_da_thanh_toan, 0) > 0 THEN 1 END)',
        'paidCount',
      )
      .addSelect(
        'COUNT(CASE WHEN COALESCE(c.tien_con_phai_thanh_toan, 0) > 0 THEN 1 END)',
        'remainingCount',
      )
      .addSelect(
        'COUNT(CASE WHEN COALESCE(c.tien_da_thanh_toan, 0) <= 0 AND COALESCE(c.tien_co_thue, 0) > 0 THEN 1 END)',
        'unpaidCount',
      )
      .where('c.kgara_deleted_at IS NULL')
      .andWhere('(c.tinh_trang_dich_vu IS NULL OR c.tinh_trang_dich_vu != 9)')
      .andWhere('c.ngay_hoan_thanh_cong_viec IS NOT NULL')
      .andWhere('c.ngay_hoan_thanh_cong_viec >= :dateFrom', { dateFrom })
      .andWhere('c.ngay_hoan_thanh_cong_viec <= :dateTo', {
        dateTo: effectiveDateTo,
      })
      .getRawOne();

    // 3.2 Phân rã theo Phân loại ERP toàn kỳ
    const classificationSummaryRaw = await this.caseRepo
      .createQueryBuilder('c')
      .select(
        `CASE 
          WHEN c.classification = 'SUA_CHUA_CHUNG' THEN 'SUA_CHUA_CHUNG'
          WHEN c.classification IN ('KY_GUI_NOI_BO', 'KY_GUI', 'NOI_BO') THEN 'KY_GUI_NOI_BO'
          WHEN c.classification IN ('OJ', 'OJ_NGOAI') THEN 'OJ_NGOAI'
          ELSE 'KHAC'
        END`,
        'classificationKey',
      )
      .addSelect('COUNT(c.id)', 'count')
      .addSelect('SUM(COALESCE(c.tien_co_thue, 0))', 'amount')
      .addSelect('SUM(COALESCE(c.tien_da_thanh_toan, 0))', 'paid')
      .addSelect('SUM(COALESCE(c.tien_con_phai_thanh_toan, 0))', 'remaining')
      .where('c.kgara_deleted_at IS NULL')
      .andWhere('(c.tinh_trang_dich_vu IS NULL OR c.tinh_trang_dich_vu != 9)')
      .andWhere('c.ngay_hoan_thanh_cong_viec IS NOT NULL')
      .andWhere('c.ngay_hoan_thanh_cong_viec >= :dateFrom', { dateFrom })
      .andWhere('c.ngay_hoan_thanh_cong_viec <= :dateTo', {
        dateTo: effectiveDateTo,
      })
      .groupBy('1')
      .getRawMany();

    const classificationSummary: Record<
      string,
      {
        name: string;
        count: number;
        amount: number;
        paid: number;
        remaining: number;
      }
    > = {
      SUA_CHUA_CHUNG: {
        name: 'Sửa chữa chung',
        count: 0,
        amount: 0,
        paid: 0,
        remaining: 0,
      },
      KY_GUI_NOI_BO: {
        name: 'Ký gửi / Nội bộ',
        count: 0,
        amount: 0,
        paid: 0,
        remaining: 0,
      },
      OJ_NGOAI: {
        name: 'OJ Ngoài',
        count: 0,
        amount: 0,
        paid: 0,
        remaining: 0,
      },
      KHAC: { name: 'Khác', count: 0, amount: 0, paid: 0, remaining: 0 },
    };

    for (const item of classificationSummaryRaw) {
      const key = item.classificationKey || 'KHAC';
      if (classificationSummary[key]) {
        classificationSummary[key].count = Number(item.count) || 0;
        classificationSummary[key].amount = Number(item.amount) || 0;
        classificationSummary[key].paid = Number(item.paid) || 0;
        classificationSummary[key].remaining = Number(item.remaining) || 0;
      }
    }

    const totalTienCoThue = Number(summaryRaw?.totalTienCoThue) || 0;
    const totalPaid = Number(summaryRaw?.totalPaid) || 0;
    const totalRemaining = Number(summaryRaw?.totalRemaining) || 0;
    const collectionRate =
      totalTienCoThue > 0
        ? Math.round((totalPaid / totalTienCoThue) * 1000) / 10
        : 0;

    const summary = {
      totalCount: Number(summaryRaw?.totalCount) || 0,
      totalTienCoThue,
      totalRevenue: Number(summaryRaw?.totalRevenue) || 0,
      totalCost: Number(summaryRaw?.totalCost) || 0,
      totalProfit: Number(summaryRaw?.totalProfit) || 0,
      totalPaid,
      totalRemaining,
      collectionRate,
      paidCount: Number(summaryRaw?.paidCount) || 0,
      remainingCount: Number(summaryRaw?.remainingCount) || 0,
      unpaidCount: Number(summaryRaw?.unpaidCount) || 0,
    };

    // 3.3 Truy vấn Danh sách Phân trang có Bộ lọc
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
      .andWhere('c.ngay_hoan_thanh_cong_viec >= :dateFrom', { dateFrom })
      .andWhere('c.ngay_hoan_thanh_cong_viec <= :dateTo', {
        dateTo: effectiveDateTo,
      });

    // Filter by search keyword
    if (search && search.trim()) {
      const s = `%${search.trim()}%`;
      qb.andWhere(
        '(c.so_chung_tu ILIKE :search OR c.bien_so_xe ILIKE :search OR c.khach_hang_name ILIKE :search OR c.khach_hang_code ILIKE :search)',
        { search: s },
      );
    }

    // Filter by payment status
    if (paymentStatus === 'remaining') {
      qb.andWhere('COALESCE(c.tien_con_phai_thanh_toan, 0) > 0');
    } else if (paymentStatus === 'paid') {
      qb.andWhere(
        'COALESCE(c.tien_con_phai_thanh_toan, 0) <= 0 AND COALESCE(c.tien_da_thanh_toan, 0) > 0',
      );
    } else if (paymentStatus === 'unpaid') {
      qb.andWhere('COALESCE(c.tien_da_thanh_toan, 0) <= 0');
    }

    // Filter by classification
    if (classification && classification !== 'ALL') {
      if (classification === 'SUA_CHUA_CHUNG') {
        qb.andWhere("c.classification = 'SUA_CHUA_CHUNG'");
      } else if (classification === 'KY_GUI_NOI_BO') {
        qb.andWhere(
          "c.classification IN ('KY_GUI_NOI_BO', 'KY_GUI', 'NOI_BO')",
        );
      } else if (classification === 'OJ_NGOAI') {
        qb.andWhere("c.classification IN ('OJ', 'OJ_NGOAI')");
      } else if (classification === 'KHAC') {
        qb.andWhere(
          "(c.classification IS NULL OR c.classification NOT IN ('SUA_CHUA_CHUNG', 'KY_GUI_NOI_BO', 'KY_GUI', 'NOI_BO', 'OJ', 'OJ_NGOAI'))",
        );
      }
    }

    // Dynamic sorting
    if (sortBy === 'tienCoThue') {
      qb.orderBy('c.tienCoThue', sortOrder);
    } else if (sortBy === 'tienDaThanhToan') {
      qb.orderBy('c.tienDaThanhToan', sortOrder);
    } else if (sortBy === 'tienConPhaiThanhToan') {
      qb.orderBy('c.tienConPhaiThanhToan', sortOrder);
    } else if (sortBy === 'doanhThu') {
      qb.orderBy('COALESCE(c.doanhThu, c.tienCoThue, 0)', sortOrder);
    } else {
      qb.orderBy('c.ngayHoanThanhCongViec', sortOrder);
    }

    qb.skip((page - 1) * pageSize).take(pageSize);

    const [items, total] = await qb.getManyAndCount();

    return {
      items: items.map((c: any) => {
        const gp = c.grossProfit;
        const rev = Number(gp?.doanhThu ?? c.doanhThu ?? c.tienCoThue ?? 0);
        const cost = Number(gp?.chiPhi ?? c.chiPhi ?? 0);
        const profit = Number(gp?.loiNhuan ?? c.loiNhuan ?? rev - cost);
        const rawData = c.rawData || {};
        const tienThueKH = Number(rawData.TienThueKH ?? 0);

        return {
          id: c.id,
          soChungTu: c.soChungTu,
          bienSoXe: c.bienSoXe,
          khachHangCode: c.khachHangCode,
          khachHangName: c.khachHangName,
          tenTinhTrangDichVu: c.tenTinhTrangDichVu,
          classification: c.classification || 'KHAC',
          doanhThu: rev,
          chiPhi: cost,
          loiNhuan: profit,
          tienCoThue: Number(c.tienCoThue ?? 0),
          tienDaThanhToan: Number(c.tienDaThanhToan ?? 0),
          tienConPhaiThanhToan: Number(c.tienConPhaiThanhToan ?? 0),
          hasInvoice: tienThueKH > 0,
          ngayHoanThanhCongViec: c.ngayHoanThanhCongViec,
          ngayPhatSinh: c.ngayPhatSinh || c.createdAt,
        };
      }),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      summary,
      classificationSummary,
    };
  }
}
