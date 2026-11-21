import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KgaraCase } from '../entities/kgara_case.entity';
import { KgaraGrossProfit } from '../entities/kgara_gross_profit.entity';
import { quotationStatusSql } from '../helpers/kgara-case-filter.helper';
import { buildCheckpointStageSelects } from '../helpers/garage-checkpoint-stages.sql';
import {
  OPEN_CASE_SQL,
  applyCheckpointCaseFilters,
  type CheckpointCaseFilters,
} from '../helpers/garage-checkpoint-case-filters';
import { toCheckpointCaseItem } from '../helpers/garage-checkpoint-case-item.mapper';
import { listCheckpointVehicles } from '../helpers/garage-checkpoint-vehicles.query';
import {
  countVehiclesSql,
  vehicleKeySql,
} from '@/common/utils/vehicle-count-sql';

/** Số XE (biển số đã chuẩn hóa) của nhóm phiếu; số phiếu lấy riêng qua alias `totalCases`. */
const VEHICLE_COUNT_SQL = countVehiclesSql(vehicleKeySql('c', 'bien_so_xe'));

/** Số XE thỏa điều kiện (distinct biển số của các phiếu khớp điều kiện). */
const vehiclesWhen = (cond: string) =>
  countVehiclesSql(vehicleKeySql('c', 'bien_so_xe'), cond);
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
        .andWhere('(c.exclude_from_reports IS NOT TRUE)')
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
      .addSelect(VEHICLE_COUNT_SQL, 'count')
      .addSelect('COUNT(c.id)', 'totalCases')
      .where('c.kgara_deleted_at IS NULL')
      .andWhere('(c.exclude_from_reports IS NOT TRUE)')
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
        .andWhere('(c.exclude_from_reports IS NOT TRUE)')
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
      .addSelect(VEHICLE_COUNT_SQL, 'count')
      .addSelect('COUNT(c.id)', 'totalCases')
      .where('c.kgara_deleted_at IS NULL')
      .andWhere('(c.exclude_from_reports IS NOT TRUE)')
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
        .andWhere('(c.exclude_from_reports IS NOT TRUE)')
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
      .addSelect(VEHICLE_COUNT_SQL, 'count')
      .addSelect('COUNT(c.id)', 'totalCases')
      .where('c.kgara_deleted_at IS NULL')
      .andWhere('(c.exclude_from_reports IS NOT TRUE)')
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
      .leftJoin('erp_module_categories', 'cat', 'cat.id = c.category_id')
      .select(
        `CASE 
          WHEN COALESCE(cat.code, c.classification) = 'SUA_CHUA_CHUNG' THEN 'SUA_CHUA_CHUNG'
          WHEN COALESCE(cat.code, c.classification) IN ('KY_GUI_NOI_BO', 'KY_GUI', 'NOI_BO') THEN 'KY_GUI_NOI_BO'
          WHEN COALESCE(cat.code, c.classification) IN ('OJ', 'OJ_NGOAI') THEN 'OJ_NGOAI'
          ELSE 'KHAC'
        END`,
        'classificationKey',
      )
      .addSelect(VEHICLE_COUNT_SQL, 'count')
      .addSelect('SUM(COALESCE(c.tien_co_thue, 0))', 'amount')
      .where('c.kgara_deleted_at IS NULL')
      .andWhere('(c.exclude_from_reports IS NOT TRUE)')
      .andWhere('(c.tinh_trang_dich_vu IS NULL OR c.tinh_trang_dich_vu != 9)')
      .andWhere('c.ngay_hoan_thanh_cong_viec IS NULL');

    const inProgressDayCond =
      'COALESCE(c.ngay_phat_sinh, c.created_at) >= :curDayStart AND COALESCE(c.ngay_phat_sinh, c.created_at) <= :curDayEnd';
    const inProgressDayParams = { curDayStart, curDayEnd };

    // Pipeline tháng này (tất cả xe đang làm)
    const inProgressMonthRaw = await inProgressCasesQb
      .clone()
      .groupBy('1')
      .getRawMany();
    // Tổng số xe khác nhau (một xe có nhiều lệnh khác phân loại không được cộng hai lần)
    const inProgressMonthTotalRes = await inProgressCasesQb
      .clone()
      .select(VEHICLE_COUNT_SQL, 'count')
      .getRawOne();

    // Pipeline hôm nay (xe đang làm phát sinh trong ngày)
    const inProgressTodayRaw = await inProgressCasesQb
      .clone()
      .andWhere(inProgressDayCond, inProgressDayParams)
      .groupBy('1')
      .getRawMany();
    const inProgressTodayTotalRes = await inProgressCasesQb
      .clone()
      .select(VEHICLE_COUNT_SQL, 'count')
      .andWhere(inProgressDayCond, inProgressDayParams)
      .getRawOne();

    const formatPipeline = (rawItems: any[], totalVehicles: number) => {
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
        totalAmount += amt;
        if (byClassification[key]) {
          byClassification[key].count += cnt;
          byClassification[key].amount += amt;
        }
      }

      return {
        totalCount: totalVehicles,
        totalAmount,
        byClassification,
      };
    };

    const projectedToday = formatPipeline(
      inProgressTodayRaw,
      Number(inProgressTodayTotalRes?.count) || 0,
    );
    const projectedMonth = formatPipeline(
      inProgressMonthRaw,
      Number(inProgressMonthTotalRes?.count) || 0,
    );

    /**
     * 5. Helper truy vấn số lượng xe theo các giai đoạn tiếp nhận và cơ cấu phân loại trong khoảng thời gian [startDate, endDate]:
     * - totalIntake: Tổng số xe tiếp nhận trong kỳ (mới + các giai đoạn)
     * - intake: Mới tiếp nhận (status = 0 hoặc tên chứa 'tiếp nhận')
     * - quotation: Đang báo giá (status = 1 hoặc tên chứa báo giá/chờ/nháp)
     * - inProgress: Đang sửa chữa / xử lý dịch vụ
     * - completed: Đã hoàn tất công việc / nghiệm thu
     * - cancelled: Hủy / từ chối dịch vụ (status = 9)
     * - classifications: Cơ cấu 4 phân loại xe trong kỳ (suaChua, kyGui, oj, khac)
     * - byStage: Chi tiết cơ cấu phân loại cho từng giai đoạn (intake, quotation, inProgress, completed)
     */
    const getPeriodStages = async (startDate: string, endDate: string) => {
      const selects = buildCheckpointStageSelects('bien_so_xe');
      const [first, ...rest] = selects;
      const qb = this.caseRepo
        .createQueryBuilder('c')
        .select(first.expr, first.alias);
      for (const sel of rest) qb.addSelect(sel.expr, sel.alias);
      const res = await qb
        .where('c.kgara_deleted_at IS NULL')
        .andWhere('(c.exclude_from_reports IS NOT TRUE)')
        .andWhere(
          'COALESCE(c.ngay_hoan_thanh_cong_viec, c.ngay_phat_sinh, c.created_at) >= :startDate AND COALESCE(c.ngay_hoan_thanh_cong_viec, c.ngay_phat_sinh, c.created_at) <= :endDate',
          { startDate, endDate },
        )
        .getRawOne();

      return {
        totalCases: Number(res?.totalCases) || 0,
        totalIntake: Number(res?.totalIntake) || 0,
        intake: Number(res?.intakeCount) || 0,
        intakeAmount: Number(res?.intakeAmount) || 0,
        quotation: Number(res?.quotationCount) || 0,
        quotationAmount: Number(res?.quotationAmount) || 0,
        inProgress: Number(res?.inProgressCount) || 0,
        inProgressAmount: Number(res?.inProgressAmount) || 0,
        completed: Number(res?.completedCount) || 0,
        completedAmount: Number(res?.completedAmount) || 0,
        cancelled: Number(res?.cancelledCount) || 0,
        classifications: {
          suaChua: Number(res?.totalSuaChua) || 0,
          kyGui: Number(res?.totalKyGui) || 0,
          oj: Number(res?.totalOj) || 0,
          khac: Number(res?.totalKhac) || 0,
        },
        byStage: {
          intake: {
            suaChua: Number(res?.intakeSuaChua) || 0,
            kyGui: Number(res?.intakeKyGui) || 0,
            oj: Number(res?.intakeOj) || 0,
            khac: Number(res?.intakeKhac) || 0,
          },
          quotation: {
            suaChua: Number(res?.quotationSuaChua) || 0,
            kyGui: Number(res?.quotationKyGui) || 0,
            oj: Number(res?.quotationOj) || 0,
            khac: Number(res?.quotationKhac) || 0,
          },
          inProgress: {
            suaChua: Number(res?.inProgressSuaChua) || 0,
            kyGui: Number(res?.inProgressKyGui) || 0,
            oj: Number(res?.inProgressOj) || 0,
            khac: Number(res?.inProgressKhac) || 0,
          },
          completed: {
            suaChua: Number(res?.completedSuaChua) || 0,
            kyGui: Number(res?.completedKyGui) || 0,
            oj: Number(res?.completedOj) || 0,
            khac: Number(res?.completedKhac) || 0,
          },
        },
      };
    };

    // Truy vấn song song thống kê giai đoạn tiếp nhận cho Tháng, Tuần, Hôm nay
    const [monthStages, weekStages, dayStages] = await Promise.all([
      getPeriodStages(curMonthStart, curMonthEnd),
      getPeriodStages(curWeekStart, curWeekEnd),
      getPeriodStages(curDayStart, curDayEnd),
    ]);

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
        totalCases: Number(curMonthRes?.totalCases) || 0,
        stages: monthStages,
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
        totalCases: Number(curWeekRes?.totalCases) || 0,
        stages: weekStages,
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
        totalCases: Number(curDayRes?.totalCases) || 0,
        stages: dayStages,
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
    status?: string,
    isFunnel?: boolean,
    groupBy: 'case' | 'vehicle' = 'case',
  ) {
    const effectiveDateTo =
      dateTo.length === 10 ? `${dateTo} 23:59:59.999` : dateTo;

    const isFunnelMode = Boolean(
      (classification && classification !== 'ALL') ||
      isFunnel ||
      (status && status.toLowerCase() !== 'all'),
    );
    const openCase = OPEN_CASE_SQL;
    const quotation = quotationStatusSql('c');
    const filters: CheckpointCaseFilters = {
      dateFrom,
      effectiveDateTo,
      isFunnelMode,
      status,
      search,
      paymentStatus,
      classification,
    };

    // 3.1 Truy vấn Summary Toàn Kỳ (Không bị phân trang)
    const summaryQb = this.caseRepo
      .createQueryBuilder('c')
      .leftJoin('erp_module_categories', 'cat', 'cat.id = c.category_id')
      .leftJoin(
        KgaraGrossProfit,
        'gp',
        'gp.hd_phieu_dich_vu_id = c.hd_phieu_dich_vu_id OR gp.vu_viec_code = c.so_chung_tu',
      )
      .select(VEHICLE_COUNT_SQL, 'totalCount')
      .addSelect('COUNT(DISTINCT c.id)', 'totalCases')
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
        vehiclesWhen(
          'COALESCE(c.tien_con_phai_thanh_toan, 0) <= 0 AND COALESCE(c.tien_da_thanh_toan, 0) > 0',
        ),
        'paidCount',
      )
      .addSelect(
        vehiclesWhen('COALESCE(c.tien_con_phai_thanh_toan, 0) > 0'),
        'remainingCount',
      )
      .addSelect(
        vehiclesWhen(
          'COALESCE(c.tien_da_thanh_toan, 0) <= 0 AND COALESCE(c.tien_co_thue, 0) > 0',
        ),
        'unpaidCount',
      )
      .addSelect(vehiclesWhen(`${openCase} AND ${quotation}`), 'quotationCount')
      .addSelect(
        vehiclesWhen(`${openCase} AND NOT (${quotation})`),
        'inProgressCount',
      )
      .addSelect(
        vehiclesWhen(
          'c.ngay_hoan_thanh_cong_viec IS NOT NULL AND (c.tinh_trang_dich_vu IS NULL OR c.tinh_trang_dich_vu != 9)',
        ),
        'completedCount',
      )
      .addSelect(vehiclesWhen('c.tinh_trang_dich_vu = 9'), 'cancelledCount')
      .where('c.kgara_deleted_at IS NULL')
      .andWhere('(c.exclude_from_reports IS NOT TRUE)');

    applyCheckpointCaseFilters(summaryQb, filters);

    const summaryRaw = await summaryQb.getRawOne();

    // 3.2 Phân rã theo Phân loại ERP toàn kỳ
    const classificationSummaryRaw = await this.caseRepo
      .createQueryBuilder('c')
      .leftJoin('erp_module_categories', 'cat', 'cat.id = c.category_id')
      .select(
        `CASE 
          WHEN COALESCE(cat.code, c.classification) = 'SUA_CHUA_CHUNG' THEN 'SUA_CHUA_CHUNG'
          WHEN COALESCE(cat.code, c.classification) IN ('KY_GUI_NOI_BO', 'KY_GUI', 'NOI_BO') THEN 'KY_GUI_NOI_BO'
          WHEN COALESCE(cat.code, c.classification) IN ('OJ', 'OJ_NGOAI') THEN 'OJ_NGOAI'
          ELSE 'KHAC'
        END`,
        'classificationKey',
      )
      .addSelect(VEHICLE_COUNT_SQL, 'count')
      .addSelect('SUM(COALESCE(c.tien_co_thue, 0))', 'amount')
      .addSelect('SUM(COALESCE(c.tien_da_thanh_toan, 0))', 'paid')
      .addSelect('SUM(COALESCE(c.tien_con_phai_thanh_toan, 0))', 'remaining')
      .where('c.kgara_deleted_at IS NULL')
      .andWhere('(c.exclude_from_reports IS NOT TRUE)')
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
      totalCases: Number(summaryRaw?.totalCases) || 0,
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
      funnelCounts: {
        total: Number(summaryRaw?.totalCount) || 0,
        quotation: Number(summaryRaw?.quotationCount) || 0,
        inProgress: Number(summaryRaw?.inProgressCount) || 0,
        completed: Number(summaryRaw?.completedCount) || 0,
        cancelled: Number(summaryRaw?.cancelledCount) || 0,
      },
    };

    // 3.3a Danh sách gom theo XE: phân trang và total theo xe, mỗi dòng kèm các lệnh của xe
    if (groupBy === 'vehicle') {
      const { items, total } = await listCheckpointVehicles(this.caseRepo, {
        filters,
        page,
        pageSize,
        sortBy,
        sortOrder,
      });
      return {
        items,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        summary,
        classificationSummary,
        groupBy: 'vehicle' as const,
      };
    }

    // 3.3 Truy vấn Danh sách Phan trang có Bộ lọc
    const qb = this.caseRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.category', 'cat')
      .leftJoinAndMapOne(
        'c.grossProfit',
        KgaraGrossProfit,
        'gp',
        'gp.hd_phieu_dich_vu_id = c.hd_phieu_dich_vu_id OR gp.vu_viec_code = c.so_chung_tu',
      )
      .where('c.kgara_deleted_at IS NULL')
      .andWhere('(c.exclude_from_reports IS NOT TRUE)');

    applyCheckpointCaseFilters(qb, filters);

    // Dynamic sorting
    if (sortBy === 'tienCoThue') {
      qb.orderBy('c.tienCoThue', sortOrder);
    } else if (sortBy === 'tienDaThanhToan') {
      qb.orderBy('c.tienDaThanhToan', sortOrder);
    } else if (sortBy === 'tienConPhaiThanhToan') {
      qb.orderBy('c.tienConPhaiThanhToan', sortOrder);
    } else if (sortBy === 'doanhThu') {
      qb.orderBy('c.doanhThu', sortOrder).addOrderBy('c.tienCoThue', sortOrder);
    } else if (sortBy === 'ngayPhatSinh') {
      qb.orderBy('c.ngayPhatSinh', sortOrder, 'NULLS LAST');
    } else if (sortBy === 'soChungTu') {
      qb.orderBy('c.soChungTu', sortOrder);
    } else {
      if (isFunnelMode) {
        qb.orderBy('c.ngayPhatSinh', sortOrder, 'NULLS LAST')
          .addOrderBy('c.ngayHoanThanhCongViec', sortOrder, 'NULLS LAST')
          .addOrderBy('c.createdAt', sortOrder);
      } else {
        qb.orderBy('c.ngayHoanThanhCongViec', sortOrder);
      }
    }

    qb.skip((page - 1) * pageSize).take(pageSize);

    const [items, total] = await qb.getManyAndCount();

    return {
      items: items.map(toCheckpointCaseItem),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      summary,
      classificationSummary,
      groupBy: 'case' as const,
    };
  }
}
