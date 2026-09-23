import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KgaraCase } from './entities/kgara_case.entity';
import { KgaraCaseService } from './entities/kgara_case_service.entity';
import { KgaraGrossProfit } from './entities/kgara_gross_profit.entity';
import { KgaraCaseSettlement } from './entities/kgara_case_settlement.entity';
import { GarageOpexService } from './services/garage-opex.service';
import { ListGarageOpexQueryDto } from './dto/garage-opex.dto';
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
      // Classification Breakdowns: Sửa chữa chung
      .addSelect(
        "SUM(CASE WHEN c.classification = 'SUA_CHUA_CHUNG' THEN COALESCE(c.tien_co_thue, 0) ELSE 0 END)",
        'tienCoThueSuaChuaChung',
      )
      .addSelect(
        "SUM(CASE WHEN c.classification = 'SUA_CHUA_CHUNG' THEN COALESCE(c.tien_da_thanh_toan, 0) ELSE 0 END)",
        'paidSuaChuaChung',
      )
      .addSelect(
        "SUM(CASE WHEN c.classification = 'SUA_CHUA_CHUNG' THEN COALESCE(c.tien_con_phai_thanh_toan, 0) ELSE 0 END)",
        'receivableSuaChuaChung',
      )
      .addSelect(
        "SUM(CASE WHEN c.classification = 'SUA_CHUA_CHUNG' AND (c.raw_data->>'TienThueKH' IS NOT NULL AND (c.raw_data->>'TienThueKH') ~ '^[0-9.]+$' AND (c.raw_data->>'TienThueKH')::numeric > 0) THEN COALESCE(c.tien_con_phai_thanh_toan, 0) ELSE 0 END)",
        'receivableWithInvoiceSuaChuaChung',
      )
      .addSelect(
        "SUM(CASE WHEN c.classification = 'SUA_CHUA_CHUNG' AND NOT (c.raw_data->>'TienThueKH' IS NOT NULL AND (c.raw_data->>'TienThueKH') ~ '^[0-9.]+$' AND (c.raw_data->>'TienThueKH')::numeric > 0) THEN COALESCE(c.tien_con_phai_thanh_toan, 0) ELSE 0 END)",
        'receivableNoInvoiceSuaChuaChung',
      )
      .addSelect(
        "SUM(CASE WHEN c.classification = 'SUA_CHUA_CHUNG' THEN COALESCE(gp.doanh_thu, c.doanh_thu, c.tien_co_thue, 0) ELSE 0 END)",
        'revenueSuaChuaChung',
      )
      .addSelect(
        "SUM(CASE WHEN c.classification = 'SUA_CHUA_CHUNG' THEN COALESCE(gp.chi_phi, c.chi_phi, 0) ELSE 0 END)",
        'costSuaChuaChung',
      )
      .addSelect(
        "SUM(CASE WHEN c.classification = 'SUA_CHUA_CHUNG' AND (c.raw_data->>'TienThueKH' IS NOT NULL AND (c.raw_data->>'TienThueKH') ~ '^[0-9.]+$' AND (c.raw_data->>'TienThueKH')::numeric > 0) THEN COALESCE(gp.chi_phi, c.chi_phi, 0) ELSE 0 END)",
        'costWithInvoiceSuaChuaChung',
      )
      .addSelect(
        "SUM(CASE WHEN c.classification = 'SUA_CHUA_CHUNG' AND NOT (c.raw_data->>'TienThueKH' IS NOT NULL AND (c.raw_data->>'TienThueKH') ~ '^[0-9.]+$' AND (c.raw_data->>'TienThueKH')::numeric > 0) THEN COALESCE(gp.chi_phi, c.chi_phi, 0) ELSE 0 END)",
        'costNoInvoiceSuaChuaChung',
      )
      .addSelect(
        "COUNT(CASE WHEN c.classification = 'SUA_CHUA_CHUNG' THEN c.id END)",
        'caseCountSuaChuaChung',
      )
      // Classification Breakdowns: Ký gửi / Nội bộ
      .addSelect(
        "SUM(CASE WHEN c.classification IN ('KY_GUI_NOI_BO', 'KY_GUI', 'NOI_BO') THEN COALESCE(c.tien_co_thue, 0) ELSE 0 END)",
        'tienCoThueKyGuiNoiBo',
      )
      .addSelect(
        "SUM(CASE WHEN c.classification IN ('KY_GUI_NOI_BO', 'KY_GUI', 'NOI_BO') THEN COALESCE(c.tien_da_thanh_toan, 0) ELSE 0 END)",
        'paidKyGuiNoiBo',
      )
      .addSelect(
        "SUM(CASE WHEN c.classification IN ('KY_GUI_NOI_BO', 'KY_GUI', 'NOI_BO') THEN COALESCE(c.tien_con_phai_thanh_toan, 0) ELSE 0 END)",
        'receivableKyGuiNoiBo',
      )
      .addSelect(
        "SUM(CASE WHEN c.classification IN ('KY_GUI_NOI_BO', 'KY_GUI', 'NOI_BO') AND (c.raw_data->>'TienThueKH' IS NOT NULL AND (c.raw_data->>'TienThueKH') ~ '^[0-9.]+$' AND (c.raw_data->>'TienThueKH')::numeric > 0) THEN COALESCE(c.tien_con_phai_thanh_toan, 0) ELSE 0 END)",
        'receivableWithInvoiceKyGuiNoiBo',
      )
      .addSelect(
        "SUM(CASE WHEN c.classification IN ('KY_GUI_NOI_BO', 'KY_GUI', 'NOI_BO') AND NOT (c.raw_data->>'TienThueKH' IS NOT NULL AND (c.raw_data->>'TienThueKH') ~ '^[0-9.]+$' AND (c.raw_data->>'TienThueKH')::numeric > 0) THEN COALESCE(c.tien_con_phai_thanh_toan, 0) ELSE 0 END)",
        'receivableNoInvoiceKyGuiNoiBo',
      )
      .addSelect(
        "SUM(CASE WHEN c.classification IN ('KY_GUI_NOI_BO', 'KY_GUI', 'NOI_BO') THEN COALESCE(gp.doanh_thu, c.doanh_thu, c.tien_co_thue, 0) ELSE 0 END)",
        'revenueKyGuiNoiBo',
      )
      .addSelect(
        "SUM(CASE WHEN c.classification IN ('KY_GUI_NOI_BO', 'KY_GUI', 'NOI_BO') THEN COALESCE(gp.chi_phi, c.chi_phi, 0) ELSE 0 END)",
        'costKyGuiNoiBo',
      )
      .addSelect(
        "SUM(CASE WHEN c.classification IN ('KY_GUI_NOI_BO', 'KY_GUI', 'NOI_BO') AND (c.raw_data->>'TienThueKH' IS NOT NULL AND (c.raw_data->>'TienThueKH') ~ '^[0-9.]+$' AND (c.raw_data->>'TienThueKH')::numeric > 0) THEN COALESCE(gp.chi_phi, c.chi_phi, 0) ELSE 0 END)",
        'costWithInvoiceKyGuiNoiBo',
      )
      .addSelect(
        "SUM(CASE WHEN c.classification IN ('KY_GUI_NOI_BO', 'KY_GUI', 'NOI_BO') AND NOT (c.raw_data->>'TienThueKH' IS NOT NULL AND (c.raw_data->>'TienThueKH') ~ '^[0-9.]+$' AND (c.raw_data->>'TienThueKH')::numeric > 0) THEN COALESCE(gp.chi_phi, c.chi_phi, 0) ELSE 0 END)",
        'costNoInvoiceKyGuiNoiBo',
      )
      .addSelect(
        "COUNT(CASE WHEN c.classification IN ('KY_GUI_NOI_BO', 'KY_GUI', 'NOI_BO') THEN c.id END)",
        'caseCountKyGuiNoiBo',
      )
      // Classification Breakdowns: OJ Ngoài
      .addSelect(
        "SUM(CASE WHEN c.classification IN ('OJ', 'OJ_NGOAI') THEN COALESCE(c.tien_co_thue, 0) ELSE 0 END)",
        'tienCoThueOj',
      )
      .addSelect(
        "SUM(CASE WHEN c.classification IN ('OJ', 'OJ_NGOAI') THEN COALESCE(c.tien_da_thanh_toan, 0) ELSE 0 END)",
        'paidOj',
      )
      .addSelect(
        "SUM(CASE WHEN c.classification IN ('OJ', 'OJ_NGOAI') THEN COALESCE(c.tien_con_phai_thanh_toan, 0) ELSE 0 END)",
        'receivableOj',
      )
      .addSelect(
        "SUM(CASE WHEN c.classification IN ('OJ', 'OJ_NGOAI') AND (c.raw_data->>'TienThueKH' IS NOT NULL AND (c.raw_data->>'TienThueKH') ~ '^[0-9.]+$' AND (c.raw_data->>'TienThueKH')::numeric > 0) THEN COALESCE(c.tien_con_phai_thanh_toan, 0) ELSE 0 END)",
        'receivableWithInvoiceOj',
      )
      .addSelect(
        "SUM(CASE WHEN c.classification IN ('OJ', 'OJ_NGOAI') AND NOT (c.raw_data->>'TienThueKH' IS NOT NULL AND (c.raw_data->>'TienThueKH') ~ '^[0-9.]+$' AND (c.raw_data->>'TienThueKH')::numeric > 0) THEN COALESCE(c.tien_con_phai_thanh_toan, 0) ELSE 0 END)",
        'receivableNoInvoiceOj',
      )
      .addSelect(
        "SUM(CASE WHEN c.classification IN ('OJ', 'OJ_NGOAI') THEN COALESCE(gp.doanh_thu, c.doanh_thu, c.tien_co_thue, 0) ELSE 0 END)",
        'revenueOj',
      )
      .addSelect(
        "SUM(CASE WHEN c.classification IN ('OJ', 'OJ_NGOAI') THEN COALESCE(gp.chi_phi, c.chi_phi, 0) ELSE 0 END)",
        'costOj',
      )
      .addSelect(
        "SUM(CASE WHEN c.classification IN ('OJ', 'OJ_NGOAI') AND (c.raw_data->>'TienThueKH' IS NOT NULL AND (c.raw_data->>'TienThueKH') ~ '^[0-9.]+$' AND (c.raw_data->>'TienThueKH')::numeric > 0) THEN COALESCE(gp.chi_phi, c.chi_phi, 0) ELSE 0 END)",
        'costWithInvoiceOj',
      )
      .addSelect(
        "SUM(CASE WHEN c.classification IN ('OJ', 'OJ_NGOAI') AND NOT (c.raw_data->>'TienThueKH' IS NOT NULL AND (c.raw_data->>'TienThueKH') ~ '^[0-9.]+$' AND (c.raw_data->>'TienThueKH')::numeric > 0) THEN COALESCE(gp.chi_phi, c.chi_phi, 0) ELSE 0 END)",
        'costNoInvoiceOj',
      )
      .addSelect(
        "COUNT(CASE WHEN c.classification IN ('OJ', 'OJ_NGOAI') THEN c.id END)",
        'caseCountOj',
      )
      // Classification Breakdowns: Khác / Chưa phân loại
      .addSelect(
        "SUM(CASE WHEN c.classification IS NULL OR c.classification NOT IN ('KY_GUI_NOI_BO', 'KY_GUI', 'NOI_BO', 'SUA_CHUA_CHUNG', 'OJ', 'OJ_NGOAI') THEN COALESCE(c.tien_co_thue, 0) ELSE 0 END)",
        'tienCoThueOther',
      )
      .addSelect(
        "SUM(CASE WHEN c.classification IS NULL OR c.classification NOT IN ('KY_GUI_NOI_BO', 'KY_GUI', 'NOI_BO', 'SUA_CHUA_CHUNG', 'OJ', 'OJ_NGOAI') THEN COALESCE(c.tien_da_thanh_toan, 0) ELSE 0 END)",
        'paidOther',
      )
      .addSelect(
        "SUM(CASE WHEN c.classification IS NULL OR c.classification NOT IN ('KY_GUI_NOI_BO', 'KY_GUI', 'NOI_BO', 'SUA_CHUA_CHUNG', 'OJ', 'OJ_NGOAI') THEN COALESCE(c.tien_con_phai_thanh_toan, 0) ELSE 0 END)",
        'receivableOther',
      )
      .addSelect(
        "SUM(CASE WHEN (c.classification IS NULL OR c.classification NOT IN ('KY_GUI_NOI_BO', 'KY_GUI', 'NOI_BO', 'SUA_CHUA_CHUNG', 'OJ', 'OJ_NGOAI')) AND (c.raw_data->>'TienThueKH' IS NOT NULL AND (c.raw_data->>'TienThueKH') ~ '^[0-9.]+$' AND (c.raw_data->>'TienThueKH')::numeric > 0) THEN COALESCE(c.tien_con_phai_thanh_toan, 0) ELSE 0 END)",
        'receivableWithInvoiceOther',
      )
      .addSelect(
        "SUM(CASE WHEN (c.classification IS NULL OR c.classification NOT IN ('KY_GUI_NOI_BO', 'KY_GUI', 'NOI_BO', 'SUA_CHUA_CHUNG', 'OJ', 'OJ_NGOAI')) AND NOT (c.raw_data->>'TienThueKH' IS NOT NULL AND (c.raw_data->>'TienThueKH') ~ '^[0-9.]+$' AND (c.raw_data->>'TienThueKH')::numeric > 0) THEN COALESCE(c.tien_con_phai_thanh_toan, 0) ELSE 0 END)",
        'receivableNoInvoiceOther',
      )
      .addSelect(
        "SUM(CASE WHEN c.classification IS NULL OR c.classification NOT IN ('KY_GUI_NOI_BO', 'KY_GUI', 'NOI_BO', 'SUA_CHUA_CHUNG', 'OJ', 'OJ_NGOAI') THEN COALESCE(gp.doanh_thu, c.doanh_thu, c.tien_co_thue, 0) ELSE 0 END)",
        'revenueOther',
      )
      .addSelect(
        "SUM(CASE WHEN c.classification IS NULL OR c.classification NOT IN ('KY_GUI_NOI_BO', 'KY_GUI', 'NOI_BO', 'SUA_CHUA_CHUNG', 'OJ', 'OJ_NGOAI') THEN COALESCE(gp.chi_phi, c.chi_phi, 0) ELSE 0 END)",
        'costOther',
      )
      .addSelect(
        "SUM(CASE WHEN (c.classification IS NULL OR c.classification NOT IN ('KY_GUI_NOI_BO', 'KY_GUI', 'NOI_BO', 'SUA_CHUA_CHUNG', 'OJ', 'OJ_NGOAI')) AND (c.raw_data->>'TienThueKH' IS NOT NULL AND (c.raw_data->>'TienThueKH') ~ '^[0-9.]+$' AND (c.raw_data->>'TienThueKH')::numeric > 0) THEN COALESCE(gp.chi_phi, c.chi_phi, 0) ELSE 0 END)",
        'costWithInvoiceOther',
      )
      .addSelect(
        "SUM(CASE WHEN (c.classification IS NULL OR c.classification NOT IN ('KY_GUI_NOI_BO', 'KY_GUI', 'NOI_BO', 'SUA_CHUA_CHUNG', 'OJ', 'OJ_NGOAI')) AND NOT (c.raw_data->>'TienThueKH' IS NOT NULL AND (c.raw_data->>'TienThueKH') ~ '^[0-9.]+$' AND (c.raw_data->>'TienThueKH')::numeric > 0) THEN COALESCE(gp.chi_phi, c.chi_phi, 0) ELSE 0 END)",
        'costNoInvoiceOther',
      )
      .addSelect(
        "COUNT(CASE WHEN c.classification IS NULL OR c.classification NOT IN ('KY_GUI_NOI_BO', 'KY_GUI', 'NOI_BO', 'SUA_CHUA_CHUNG', 'OJ', 'OJ_NGOAI') THEN c.id END)",
        'caseCountOther',
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
      .addSelect(
        "SUM(CASE WHEN c.classification = 'SUA_CHUA_CHUNG' THEN s.amount ELSE 0 END)",
        'paidCostSuaChuaChung',
      )
      .addSelect(
        "SUM(CASE WHEN c.classification = 'SUA_CHUA_CHUNG' AND (c.raw_data->>'TienThueKH' IS NOT NULL AND (c.raw_data->>'TienThueKH') ~ '^[0-9.]+$' AND (c.raw_data->>'TienThueKH')::numeric > 0) THEN s.amount ELSE 0 END)",
        'paidCostWithInvoiceSuaChuaChung',
      )
      .addSelect(
        "SUM(CASE WHEN c.classification = 'SUA_CHUA_CHUNG' AND NOT (c.raw_data->>'TienThueKH' IS NOT NULL AND (c.raw_data->>'TienThueKH') ~ '^[0-9.]+$' AND (c.raw_data->>'TienThueKH')::numeric > 0) THEN s.amount ELSE 0 END)",
        'paidCostNoInvoiceSuaChuaChung',
      )
      .addSelect(
        "SUM(CASE WHEN c.classification IN ('KY_GUI_NOI_BO', 'KY_GUI', 'NOI_BO') THEN s.amount ELSE 0 END)",
        'paidCostKyGuiNoiBo',
      )
      .addSelect(
        "SUM(CASE WHEN c.classification IN ('KY_GUI_NOI_BO', 'KY_GUI', 'NOI_BO') AND (c.raw_data->>'TienThueKH' IS NOT NULL AND (c.raw_data->>'TienThueKH') ~ '^[0-9.]+$' AND (c.raw_data->>'TienThueKH')::numeric > 0) THEN s.amount ELSE 0 END)",
        'paidCostWithInvoiceKyGuiNoiBo',
      )
      .addSelect(
        "SUM(CASE WHEN c.classification IN ('KY_GUI_NOI_BO', 'KY_GUI', 'NOI_BO') AND NOT (c.raw_data->>'TienThueKH' IS NOT NULL AND (c.raw_data->>'TienThueKH') ~ '^[0-9.]+$' AND (c.raw_data->>'TienThueKH')::numeric > 0) THEN s.amount ELSE 0 END)",
        'paidCostNoInvoiceKyGuiNoiBo',
      )
      .addSelect(
        "SUM(CASE WHEN c.classification IN ('OJ', 'OJ_NGOAI') THEN s.amount ELSE 0 END)",
        'paidCostOj',
      )
      .addSelect(
        "SUM(CASE WHEN c.classification IN ('OJ', 'OJ_NGOAI') AND (c.raw_data->>'TienThueKH' IS NOT NULL AND (c.raw_data->>'TienThueKH') ~ '^[0-9.]+$' AND (c.raw_data->>'TienThueKH')::numeric > 0) THEN s.amount ELSE 0 END)",
        'paidCostWithInvoiceOj',
      )
      .addSelect(
        "SUM(CASE WHEN c.classification IN ('OJ', 'OJ_NGOAI') AND NOT (c.raw_data->>'TienThueKH' IS NOT NULL AND (c.raw_data->>'TienThueKH') ~ '^[0-9.]+$' AND (c.raw_data->>'TienThueKH')::numeric > 0) THEN s.amount ELSE 0 END)",
        'paidCostNoInvoiceOj',
      )
      .addSelect(
        "SUM(CASE WHEN c.classification IS NULL OR c.classification NOT IN ('KY_GUI_NOI_BO', 'KY_GUI', 'NOI_BO', 'SUA_CHUA_CHUNG', 'OJ', 'OJ_NGOAI') THEN s.amount ELSE 0 END)",
        'paidCostOther',
      )
      .addSelect(
        "SUM(CASE WHEN (c.classification IS NULL OR c.classification NOT IN ('KY_GUI_NOI_BO', 'KY_GUI', 'NOI_BO', 'SUA_CHUA_CHUNG', 'OJ', 'OJ_NGOAI')) AND (c.raw_data->>'TienThueKH' IS NOT NULL AND (c.raw_data->>'TienThueKH') ~ '^[0-9.]+$' AND (c.raw_data->>'TienThueKH')::numeric > 0) THEN s.amount ELSE 0 END)",
        'paidCostWithInvoiceOther',
      )
      .addSelect(
        "SUM(CASE WHEN (c.classification IS NULL OR c.classification NOT IN ('KY_GUI_NOI_BO', 'KY_GUI', 'NOI_BO', 'SUA_CHUA_CHUNG', 'OJ', 'OJ_NGOAI')) AND NOT (c.raw_data->>'TienThueKH' IS NOT NULL AND (c.raw_data->>'TienThueKH') ~ '^[0-9.]+$' AND (c.raw_data->>'TienThueKH')::numeric > 0) THEN s.amount ELSE 0 END)",
        'paidCostNoInvoiceOther',
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
          suaChuaChung: Number(r.paidCostSuaChuaChung) || 0,
          suaChuaChungWithInvoice:
            Number(r.paidCostWithInvoiceSuaChuaChung) || 0,
          suaChuaChungNoInvoice: Number(r.paidCostNoInvoiceSuaChuaChung) || 0,
          kyGuiNoiBo: Number(r.paidCostKyGuiNoiBo) || 0,
          kyGuiNoiBoWithInvoice: Number(r.paidCostWithInvoiceKyGuiNoiBo) || 0,
          kyGuiNoiBoNoInvoice: Number(r.paidCostNoInvoiceKyGuiNoiBo) || 0,
          oj: Number(r.paidCostOj) || 0,
          ojWithInvoice: Number(r.paidCostWithInvoiceOj) || 0,
          ojNoInvoice: Number(r.paidCostNoInvoiceOj) || 0,
          other: Number(r.paidCostOther) || 0,
          otherWithInvoice: Number(r.paidCostWithInvoiceOther) || 0,
          otherNoInvoice: Number(r.paidCostNoInvoiceOther) || 0,
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
        suaChuaChung: 0,
        suaChuaChungWithInvoice: 0,
        suaChuaChungNoInvoice: 0,
        kyGuiNoiBo: 0,
        kyGuiNoiBoWithInvoice: 0,
        kyGuiNoiBoNoInvoice: 0,
        oj: 0,
        ojWithInvoice: 0,
        ojNoInvoice: 0,
        other: 0,
        otherWithInvoice: 0,
        otherNoInvoice: 0,
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

      // ── Classification Breakdowns ──
      // 1. Sửa chữa chung
      const tcSuaChuaChung = Number(r.tienCoThueSuaChuaChung) || 0;
      const pSuaChuaChung = Number(r.paidSuaChuaChung) || 0;
      const recSuaChuaChung = Number(r.receivableSuaChuaChung) || 0;
      const recWithInvoiceScc =
        Number(r.receivableWithInvoiceSuaChuaChung) || 0;
      const recNoInvoiceScc = Number(r.receivableNoInvoiceSuaChuaChung) || 0;
      const revSuaChuaChung = Number(r.revenueSuaChuaChung) || 0;
      const billedSuaChuaChung =
        tcSuaChuaChung > 0
          ? tcSuaChuaChung
          : pSuaChuaChung + recSuaChuaChung > 0
            ? pSuaChuaChung + recSuaChuaChung
            : revSuaChuaChung;
      const rateSuaChuaChung =
        billedSuaChuaChung > 0
          ? Math.min(
              100,
              Math.round((pSuaChuaChung / billedSuaChuaChung) * 1000) / 10,
            )
          : 0;
      const costSuaChuaChung = Number(r.costSuaChuaChung) || 0;
      const costWithInvoiceScc = Number(r.costWithInvoiceSuaChuaChung) || 0;
      const costNoInvoiceScc = Number(r.costNoInvoiceSuaChuaChung) || 0;
      const paidCostSuaChuaChung = paidCostInfo.suaChuaChung;
      const paidCostWithInvoiceScc = paidCostInfo.suaChuaChungWithInvoice || 0;
      const paidCostNoInvoiceScc = paidCostInfo.suaChuaChungNoInvoice || 0;
      const payableCostSuaChuaChung = Math.max(
        0,
        costSuaChuaChung - paidCostSuaChuaChung,
      );
      const payableCostWithInvoiceScc = Math.max(
        0,
        costWithInvoiceScc - paidCostWithInvoiceScc,
      );
      const payableCostNoInvoiceScc = Math.max(
        0,
        costNoInvoiceScc - paidCostNoInvoiceScc,
      );
      const costRateSuaChuaChung =
        costSuaChuaChung > 0
          ? Math.min(
              100,
              Math.round((paidCostSuaChuaChung / costSuaChuaChung) * 1000) / 10,
            )
          : 100;

      // 2. Ký gửi / Nội bộ
      const tcKyGuiNoiBo = Number(r.tienCoThueKyGuiNoiBo) || 0;
      const pKyGuiNoiBo = Number(r.paidKyGuiNoiBo) || 0;
      const recKyGuiNoiBo = Number(r.receivableKyGuiNoiBo) || 0;
      const recWithInvoiceKgNb = Number(r.receivableWithInvoiceKyGuiNoiBo) || 0;
      const recNoInvoiceKgNb = Number(r.receivableNoInvoiceKyGuiNoiBo) || 0;
      const revKyGuiNoiBo = Number(r.revenueKyGuiNoiBo) || 0;
      const billedKyGuiNoiBo =
        tcKyGuiNoiBo > 0
          ? tcKyGuiNoiBo
          : pKyGuiNoiBo + recKyGuiNoiBo > 0
            ? pKyGuiNoiBo + recKyGuiNoiBo
            : revKyGuiNoiBo;
      const rateKyGuiNoiBo =
        billedKyGuiNoiBo > 0
          ? Math.min(
              100,
              Math.round((pKyGuiNoiBo / billedKyGuiNoiBo) * 1000) / 10,
            )
          : 0;
      const costKyGuiNoiBo = Number(r.costKyGuiNoiBo) || 0;
      const costWithInvoiceKgNb = Number(r.costWithInvoiceKyGuiNoiBo) || 0;
      const costNoInvoiceKgNb = Number(r.costNoInvoiceKyGuiNoiBo) || 0;
      const paidCostKyGuiNoiBo = paidCostInfo.kyGuiNoiBo;
      const paidCostWithInvoiceKgNb = paidCostInfo.kyGuiNoiBoWithInvoice || 0;
      const paidCostNoInvoiceKgNb = paidCostInfo.kyGuiNoiBoNoInvoice || 0;
      const payableCostKyGuiNoiBo = Math.max(
        0,
        costKyGuiNoiBo - paidCostKyGuiNoiBo,
      );
      const payableCostWithInvoiceKgNb = Math.max(
        0,
        costWithInvoiceKgNb - paidCostWithInvoiceKgNb,
      );
      const payableCostNoInvoiceKgNb = Math.max(
        0,
        costNoInvoiceKgNb - paidCostNoInvoiceKgNb,
      );
      const costRateKyGuiNoiBo =
        costKyGuiNoiBo > 0
          ? Math.min(
              100,
              Math.round((paidCostKyGuiNoiBo / costKyGuiNoiBo) * 1000) / 10,
            )
          : 100;

      // 3. OJ Ngoài
      const tcOj = Number(r.tienCoThueOj) || 0;
      const pOj = Number(r.paidOj) || 0;
      const recOj = Number(r.receivableOj) || 0;
      const recWithInvoiceOj = Number(r.receivableWithInvoiceOj) || 0;
      const recNoInvoiceOj = Number(r.receivableNoInvoiceOj) || 0;
      const revOj = Number(r.revenueOj) || 0;
      const billedOj = tcOj > 0 ? tcOj : pOj + recOj > 0 ? pOj + recOj : revOj;
      const rateOj =
        billedOj > 0
          ? Math.min(100, Math.round((pOj / billedOj) * 1000) / 10)
          : 0;
      const costOj = Number(r.costOj) || 0;
      const costWithInvoiceOj = Number(r.costWithInvoiceOj) || 0;
      const costNoInvoiceOj = Number(r.costNoInvoiceOj) || 0;
      const paidCostOj = paidCostInfo.oj;
      const paidCostWithInvoiceOj = paidCostInfo.ojWithInvoice || 0;
      const paidCostNoInvoiceOj = paidCostInfo.ojNoInvoice || 0;
      const payableCostOj = Math.max(0, costOj - paidCostOj);
      const payableCostWithInvoiceOj = Math.max(
        0,
        costWithInvoiceOj - paidCostWithInvoiceOj,
      );
      const payableCostNoInvoiceOj = Math.max(
        0,
        costNoInvoiceOj - paidCostNoInvoiceOj,
      );
      const costRateOj =
        costOj > 0
          ? Math.min(100, Math.round((paidCostOj / costOj) * 1000) / 10)
          : 100;

      // 4. Khác / Chưa phân loại
      const tcOther = Number(r.tienCoThueOther) || 0;
      const pOther = Number(r.paidOther) || 0;
      const recOther = Number(r.receivableOther) || 0;
      const recWithInvoiceOther = Number(r.receivableWithInvoiceOther) || 0;
      const recNoInvoiceOther = Number(r.receivableNoInvoiceOther) || 0;
      const revOther = Number(r.revenueOther) || 0;
      const billedOther =
        tcOther > 0
          ? tcOther
          : pOther + recOther > 0
            ? pOther + recOther
            : revOther;
      const rateOther =
        billedOther > 0
          ? Math.min(100, Math.round((pOther / billedOther) * 1000) / 10)
          : 0;
      const costOther = Number(r.costOther) || 0;
      const costWithInvoiceOther = Number(r.costWithInvoiceOther) || 0;
      const costNoInvoiceOther = Number(r.costNoInvoiceOther) || 0;
      const paidCostOther = paidCostInfo.other;
      const paidCostWithInvoiceOther = paidCostInfo.otherWithInvoice || 0;
      const paidCostNoInvoiceOther = paidCostInfo.otherNoInvoice || 0;
      const payableCostOther = Math.max(0, costOther - paidCostOther);
      const payableCostWithInvoiceOther = Math.max(
        0,
        costWithInvoiceOther - paidCostWithInvoiceOther,
      );
      const payableCostNoInvoiceOther = Math.max(
        0,
        costNoInvoiceOther - paidCostNoInvoiceOther,
      );
      const costRateOther =
        costOther > 0
          ? Math.min(100, Math.round((paidCostOther / costOther) * 1000) / 10)
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

        // Classification breakdowns: Sửa chữa chung
        caseCountSuaChuaChung: Number(r.caseCountSuaChuaChung) || 0,
        billedSuaChuaChung,
        paidSuaChuaChung: pSuaChuaChung,
        receivableSuaChuaChung: recSuaChuaChung,
        receivableWithInvoiceSuaChuaChung: recWithInvoiceScc,
        receivableNoInvoiceSuaChuaChung: recNoInvoiceScc,
        rateSuaChuaChung,
        costSuaChuaChung,
        paidCostSuaChuaChung,
        payableCostSuaChuaChung,
        payableCostWithInvoiceSuaChuaChung: payableCostWithInvoiceScc,
        payableCostNoInvoiceSuaChuaChung: payableCostNoInvoiceScc,
        costRateSuaChuaChung,

        // Classification breakdowns: Ký gửi / Nội bộ
        caseCountKyGuiNoiBo: Number(r.caseCountKyGuiNoiBo) || 0,
        billedKyGuiNoiBo,
        paidKyGuiNoiBo: pKyGuiNoiBo,
        receivableKyGuiNoiBo: recKyGuiNoiBo,
        receivableWithInvoiceKyGuiNoiBo: recWithInvoiceKgNb,
        receivableNoInvoiceKyGuiNoiBo: recNoInvoiceKgNb,
        rateKyGuiNoiBo,
        costKyGuiNoiBo,
        paidCostKyGuiNoiBo,
        payableCostKyGuiNoiBo,
        payableCostWithInvoiceKyGuiNoiBo: payableCostWithInvoiceKgNb,
        payableCostNoInvoiceKyGuiNoiBo: payableCostNoInvoiceKgNb,
        costRateKyGuiNoiBo,

        // Classification breakdowns: OJ Ngoài
        caseCountOj: Number(r.caseCountOj) || 0,
        billedOj,
        paidOj: pOj,
        receivableOj: recOj,
        receivableWithInvoiceOj: recWithInvoiceOj,
        receivableNoInvoiceOj: recNoInvoiceOj,
        rateOj,
        costOj,
        paidCostOj,
        payableCostOj,
        payableCostWithInvoiceOj: payableCostWithInvoiceOj,
        payableCostNoInvoiceOj: payableCostNoInvoiceOj,
        costRateOj,

        // Classification breakdowns: Khác / Chưa phân loại
        caseCountOther: Number(r.caseCountOther) || 0,
        billedOther,
        paidOther: pOther,
        receivableOther: recOther,
        receivableWithInvoiceOther: recWithInvoiceOther,
        receivableNoInvoiceOther: recNoInvoiceOther,
        rateOther,
        costOther,
        paidCostOther,
        payableCostOther,
        payableCostWithInvoiceOther: payableCostWithInvoiceOther,
        payableCostNoInvoiceOther: payableCostNoInvoiceOther,
        costRateOther,
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

    // 1.4 Phân bổ Trạng thái Phiếu dịch vụ (LOẠI TRỪ HỦY) theo từng tháng trong 6 tháng gần nhất
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
      .addSelect('SUM(COALESCE(c.tien_co_thue, 0))', 'revenue')
      .where('c.kgara_deleted_at IS NULL')
      .andWhere('(c.tinh_trang_dich_vu IS NULL OR c.tinh_trang_dich_vu != 9)')
      .andWhere(
        'COALESCE(c.ngay_hoan_thanh_cong_viec, c.ngay_phat_sinh, c.created_at) >= :sixMonthsAgo',
        { sixMonthsAgo },
      )
      .groupBy('1, 2, 3')
      .orderBy('month', 'DESC')
      .addOrderBy('count', 'DESC');

    const rawStatus = await statusQb.getRawMany();

    const statusDistributionByMonth: Record<string, any[]> = {};
    const statusTotalCountByMonth: Record<string, number> = {};
    const statusTotalRevenueByMonth: Record<string, number> = {};
    const overallStatusMap: Record<
      string,
      { statusCode: number; statusName: string; count: number; revenue: number }
    > = {};
    let totalStatusCount = 0;
    let totalStatusRevenue = 0;

    for (const s of rawStatus) {
      const m = s.month;
      const cnt = Number(s.count) || 0;
      const rev = Number(s.revenue) || 0;
      const statusCode = Number(s.statusCode) || 0;
      const statusName = s.statusName;

      if (!statusDistributionByMonth[m]) {
        statusDistributionByMonth[m] = [];
        statusTotalCountByMonth[m] = 0;
        statusTotalRevenueByMonth[m] = 0;
      }
      statusDistributionByMonth[m].push({
        statusCode,
        statusName,
        count: cnt,
        revenue: rev,
      });
      statusTotalCountByMonth[m] += cnt;
      statusTotalRevenueByMonth[m] += rev;

      const key = `${statusCode}_${statusName}`;
      if (!overallStatusMap[key]) {
        overallStatusMap[key] = {
          statusCode,
          statusName,
          count: 0,
          revenue: 0,
        };
      }
      overallStatusMap[key].count += cnt;
      overallStatusMap[key].revenue += rev;
      totalStatusCount += cnt;
      totalStatusRevenue += rev;
    }

    // Tính tỷ lệ % theo từng tháng
    for (const [m, items] of Object.entries(statusDistributionByMonth)) {
      const mCountTotal = statusTotalCountByMonth[m] || 1;
      const mRevTotal = statusTotalRevenueByMonth[m] || 1;
      for (const item of items) {
        item.percentage =
          Math.round(((item.count as number) / mCountTotal) * 1000) / 10;
        item.revenuePercentage =
          Math.round(((item.revenue as number) / mRevTotal) * 1000) / 10;
      }
    }

    // Tính tỷ lệ % tổng thể toàn kỳ 6 tháng
    const statusDistribution = Object.values(overallStatusMap)
      .map((s) => ({
        statusCode: s.statusCode,
        statusName: s.statusName,
        count: s.count,
        revenue: s.revenue,
        percentage:
          totalStatusCount > 0
            ? Math.round((s.count / totalStatusCount) * 1000) / 10
            : 0,
        revenuePercentage:
          totalStatusRevenue > 0
            ? Math.round((s.revenue / totalStatusRevenue) * 1000) / 10
            : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // 1.4.1 Phễu Chuyển đổi Dịch vụ (Conversion Funnel) theo 4 nhóm Phân loại ERP
    const funnelQb = this.caseRepo
      .createQueryBuilder('c')
      .select(
        "TO_CHAR(COALESCE(c.ngay_hoan_thanh_cong_viec, c.ngay_phat_sinh, c.created_at), 'YYYY-MM')",
        'month',
      )
      .addSelect(
        `CASE 
          WHEN c.classification = 'SUA_CHUA_CHUNG' THEN 'SUA_CHUA_CHUNG'
          WHEN c.classification IN ('KY_GUI_NOI_BO', 'KY_GUI', 'NOI_BO') THEN 'KY_GUI_NOI_BO'
          WHEN c.classification IN ('OJ', 'OJ_NGOAI') THEN 'OJ_NGOAI'
          ELSE 'KHAC'
        END`,
        'classificationKey',
      )
      .addSelect('COUNT(c.id)', 'totalCount')
      .addSelect('SUM(COALESCE(c.tien_co_thue, 0))', 'totalAmount')
      .addSelect(
        'COUNT(CASE WHEN c.tinh_trang_dich_vu = 9 THEN c.id END)',
        'cancelledCount',
      )
      .addSelect(
        'SUM(CASE WHEN c.tinh_trang_dich_vu = 9 THEN COALESCE(c.tien_co_thue, 0) ELSE 0 END)',
        'cancelledAmount',
      )
      .addSelect(
        'COUNT(CASE WHEN c.ngay_hoan_thanh_cong_viec IS NOT NULL AND (c.tinh_trang_dich_vu IS NULL OR c.tinh_trang_dich_vu != 9) THEN c.id END)',
        'completedCount',
      )
      .addSelect(
        'SUM(CASE WHEN c.ngay_hoan_thanh_cong_viec IS NOT NULL AND (c.tinh_trang_dich_vu IS NULL OR c.tinh_trang_dich_vu != 9) THEN COALESCE(c.tien_co_thue, 0) ELSE 0 END)',
        'completedAmount',
      )
      .addSelect(
        'COUNT(CASE WHEN c.ngay_hoan_thanh_cong_viec IS NULL AND (c.tinh_trang_dich_vu IS NULL OR c.tinh_trang_dich_vu != 9) THEN c.id END)',
        'inProgressCount',
      )
      .addSelect(
        'SUM(CASE WHEN c.ngay_hoan_thanh_cong_viec IS NULL AND (c.tinh_trang_dich_vu IS NULL OR c.tinh_trang_dich_vu != 9) THEN COALESCE(c.tien_co_thue, 0) ELSE 0 END)',
        'inProgressAmount',
      )
      .where('c.kgara_deleted_at IS NULL')
      .andWhere(
        'COALESCE(c.ngay_hoan_thanh_cong_viec, c.ngay_phat_sinh, c.created_at) >= :sixMonthsAgo',
        { sixMonthsAgo },
      )
      .groupBy('1, 2')
      .orderBy('month', 'DESC');

    const rawFunnel = await funnelQb.getRawMany();

    const buildFunnelObj = () => ({
      totalIntake: { count: 0, amount: 0 },
      inProgress: { count: 0, amount: 0, rate: 0 },
      completed: { count: 0, amount: 0, rate: 0 },
      cancelled: { count: 0, amount: 0, rate: 0 },
      byClassification: {
        SUA_CHUA_CHUNG: {
          name: 'Sửa chữa chung',
          totalCount: 0,
          totalAmount: 0,
          inProgressCount: 0,
          inProgressAmount: 0,
          completedCount: 0,
          completedAmount: 0,
          cancelledCount: 0,
          cancelledAmount: 0,
          completionRate: 0,
          cancellationRate: 0,
        },
        KY_GUI_NOI_BO: {
          name: 'Ký gửi / Nội bộ',
          totalCount: 0,
          totalAmount: 0,
          inProgressCount: 0,
          inProgressAmount: 0,
          completedCount: 0,
          completedAmount: 0,
          cancelledCount: 0,
          cancelledAmount: 0,
          completionRate: 0,
          cancellationRate: 0,
        },
        OJ_NGOAI: {
          name: 'OJ Ngoài',
          totalCount: 0,
          totalAmount: 0,
          inProgressCount: 0,
          inProgressAmount: 0,
          completedCount: 0,
          completedAmount: 0,
          cancelledCount: 0,
          cancelledAmount: 0,
          completionRate: 0,
          cancellationRate: 0,
        },
        KHAC: {
          name: 'Khác',
          totalCount: 0,
          totalAmount: 0,
          inProgressCount: 0,
          inProgressAmount: 0,
          completedCount: 0,
          completedAmount: 0,
          cancelledCount: 0,
          cancelledAmount: 0,
          completionRate: 0,
          cancellationRate: 0,
        },
      } as Record<string, any>,
    });

    const conversionFunnel = buildFunnelObj();
    const conversionFunnelByMonth: Record<
      string,
      ReturnType<typeof buildFunnelObj>
    > = {};

    for (const f of rawFunnel) {
      const m = f.month;
      const key = f.classificationKey || 'KHAC';
      const totCnt = Number(f.totalCount) || 0;
      const totAmt = Number(f.totalAmount) || 0;
      const inProgCnt = Number(f.inProgressCount) || 0;
      const inProgAmt = Number(f.inProgressAmount) || 0;
      const compCnt = Number(f.completedCount) || 0;
      const compAmt = Number(f.completedAmount) || 0;
      const cancCnt = Number(f.cancelledCount) || 0;
      const cancAmt = Number(f.cancelledAmount) || 0;

      if (!conversionFunnelByMonth[m]) {
        conversionFunnelByMonth[m] = buildFunnelObj();
      }
      const mFunnel = conversionFunnelByMonth[m];

      // Month totals
      mFunnel.totalIntake.count += totCnt;
      mFunnel.totalIntake.amount += totAmt;
      mFunnel.inProgress.count += inProgCnt;
      mFunnel.inProgress.amount += inProgAmt;
      mFunnel.completed.count += compCnt;
      mFunnel.completed.amount += compAmt;
      mFunnel.cancelled.count += cancCnt;
      mFunnel.cancelled.amount += cancAmt;

      // Month classification
      if (mFunnel.byClassification[key]) {
        const c = mFunnel.byClassification[key];
        c.totalCount += totCnt;
        c.totalAmount += totAmt;
        c.inProgressCount += inProgCnt;
        c.inProgressAmount += inProgAmt;
        c.completedCount += compCnt;
        c.completedAmount += compAmt;
        c.cancelledCount += cancCnt;
        c.cancelledAmount += cancAmt;
      }

      // Overall totals
      conversionFunnel.totalIntake.count += totCnt;
      conversionFunnel.totalIntake.amount += totAmt;
      conversionFunnel.inProgress.count += inProgCnt;
      conversionFunnel.inProgress.amount += inProgAmt;
      conversionFunnel.completed.count += compCnt;
      conversionFunnel.completed.amount += compAmt;
      conversionFunnel.cancelled.count += cancCnt;
      conversionFunnel.cancelled.amount += cancAmt;

      // Overall classification
      if (conversionFunnel.byClassification[key]) {
        const c = conversionFunnel.byClassification[key];
        c.totalCount += totCnt;
        c.totalAmount += totAmt;
        c.inProgressCount += inProgCnt;
        c.inProgressAmount += inProgAmt;
        c.completedCount += compCnt;
        c.completedAmount += compAmt;
        c.cancelledCount += cancCnt;
        c.cancelledAmount += cancAmt;
      }
    }

    // Compute conversion rates
    const computeRates = (target: ReturnType<typeof buildFunnelObj>) => {
      const tot = target.totalIntake.count || 1;
      target.inProgress.rate =
        Math.round((target.inProgress.count / tot) * 1000) / 10;
      target.completed.rate =
        Math.round((target.completed.count / tot) * 1000) / 10;
      target.cancelled.rate =
        Math.round((target.cancelled.count / tot) * 1000) / 10;

      for (const c of Object.values(target.byClassification)) {
        const cTot = c.totalCount || 1;
        c.completionRate = Math.round((c.completedCount / cTot) * 1000) / 10;
        c.cancellationRate = Math.round((c.cancelledCount / cTot) * 1000) / 10;
      }
    };

    computeRates(conversionFunnel);
    for (const mFunnel of Object.values(conversionFunnelByMonth)) {
      computeRates(mFunnel);
    }

    // 1.5 Phân bổ Loại Nghiệp vụ (Classification Distribution) theo từng tháng trong 6 tháng gần nhất
    const classificationQb = this.caseRepo
      .createQueryBuilder('c')
      .select("TO_CHAR(c.ngay_hoan_thanh_cong_viec, 'YYYY-MM')", 'month')
      .addSelect(
        `CASE 
          WHEN c.classification = 'SUA_CHUA_CHUNG' THEN 'SUA_CHUA_CHUNG'
          WHEN c.classification IN ('KY_GUI_NOI_BO', 'KY_GUI', 'NOI_BO') THEN 'KY_GUI_NOI_BO'
          WHEN c.classification IN ('OJ', 'OJ_NGOAI') THEN 'OJ_NGOAI'
          ELSE 'KHAC'
        END`,
        'classificationKey',
      )
      .addSelect('COUNT(c.id)', 'count')
      .addSelect('SUM(COALESCE(c.tien_co_thue, 0))', 'revenue')
      .where('c.kgara_deleted_at IS NULL')
      .andWhere('(c.tinh_trang_dich_vu IS NULL OR c.tinh_trang_dich_vu != 9)')
      .andWhere('c.ngay_hoan_thanh_cong_viec IS NOT NULL')
      .andWhere('c.ngay_hoan_thanh_cong_viec >= :sixMonthsAgo', {
        sixMonthsAgo,
      })
      .groupBy('1, 2')
      .orderBy('month', 'DESC')
      .addOrderBy('count', 'DESC');

    const rawClassification = await classificationQb.getRawMany();

    const classificationNames: Record<string, string> = {
      SUA_CHUA_CHUNG: 'Sửa chữa chung',
      KY_GUI_NOI_BO: 'Ký gửi / Nội bộ',
      OJ_NGOAI: 'OJ Ngoài',
      KHAC: 'Khác / Chưa phân loại',
    };

    const classificationDistributionByMonth: Record<string, any[]> = {};
    const classificationTotalCountByMonth: Record<string, number> = {};
    const classificationTotalRevenueByMonth: Record<string, number> = {};
    const overallClassificationMap: Record<
      string,
      {
        classificationKey: string;
        classificationName: string;
        count: number;
        revenue: number;
      }
    > = {};
    let totalClassificationCount = 0;
    let totalClassificationRevenue = 0;

    for (const item of rawClassification) {
      const m = item.month;
      const key = item.classificationKey || 'KHAC';
      const name = classificationNames[key] || 'Khác';
      const cnt = Number(item.count) || 0;
      const rev = Number(item.revenue) || 0;

      if (!classificationDistributionByMonth[m]) {
        classificationDistributionByMonth[m] = [];
        classificationTotalCountByMonth[m] = 0;
        classificationTotalRevenueByMonth[m] = 0;
      }

      classificationDistributionByMonth[m].push({
        classificationKey: key,
        classificationName: name,
        count: cnt,
        revenue: rev,
      });
      classificationTotalCountByMonth[m] += cnt;
      classificationTotalRevenueByMonth[m] += rev;

      if (!overallClassificationMap[key]) {
        overallClassificationMap[key] = {
          classificationKey: key,
          classificationName: name,
          count: 0,
          revenue: 0,
        };
      }
      overallClassificationMap[key].count += cnt;
      overallClassificationMap[key].revenue += rev;
      totalClassificationCount += cnt;
      totalClassificationRevenue += rev;
    }

    // Tính tỷ lệ % theo từng tháng
    for (const [m, items] of Object.entries(
      classificationDistributionByMonth,
    )) {
      const mCountTotal = classificationTotalCountByMonth[m] || 1;
      const mRevTotal = classificationTotalRevenueByMonth[m] || 1;
      for (const item of items) {
        item.percentage =
          Math.round(((item.count as number) / mCountTotal) * 1000) / 10;
        item.revenuePercentage =
          Math.round(((item.revenue as number) / mRevTotal) * 1000) / 10;
      }
    }

    // Tính tỷ lệ % tổng thể toàn kỳ 6 tháng
    const classificationDistribution = Object.values(overallClassificationMap)
      .map((c) => ({
        classificationKey: c.classificationKey,
        classificationName: c.classificationName,
        count: c.count,
        revenue: c.revenue,
        percentage:
          totalClassificationCount > 0
            ? Math.round((c.count / totalClassificationCount) * 1000) / 10
            : 0,
        revenuePercentage:
          totalClassificationRevenue > 0
            ? Math.round((c.revenue / totalClassificationRevenue) * 1000) / 10
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
      classificationDistribution,
      classificationDistributionByMonth,
      conversionFunnel,
      conversionFunnelByMonth,
      availableMonths,
    };
  }

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
      // Mảng Ký gửi / Nội bộ (dựa vào kgara_cases.classification)
      .addSelect(
        "SUM(CASE WHEN c.classification IN ('KY_GUI_NOI_BO', 'KY_GUI', 'NOI_BO') THEN COALESCE(gp.doanh_thu, c.doanh_thu, c.tien_co_thue, 0) ELSE 0 END)",
        'kyGuiRevenue',
      )
      .addSelect(
        "SUM(CASE WHEN c.classification IN ('KY_GUI_NOI_BO', 'KY_GUI', 'NOI_BO') THEN COALESCE(gp.chi_phi, c.chi_phi, 0) ELSE 0 END)",
        'kyGuiCogs',
      )
      .addSelect(
        "COUNT(CASE WHEN c.classification IN ('KY_GUI_NOI_BO', 'KY_GUI', 'NOI_BO') THEN c.id END)",
        'kyGuiCaseCount',
      )
      // Mảng Sửa chữa chung
      .addSelect(
        "SUM(CASE WHEN c.classification = 'SUA_CHUA_CHUNG' THEN COALESCE(gp.doanh_thu, c.doanh_thu, c.tien_co_thue, 0) ELSE 0 END)",
        'suaChuaChungRevenue',
      )
      .addSelect(
        "SUM(CASE WHEN c.classification = 'SUA_CHUA_CHUNG' THEN COALESCE(gp.chi_phi, c.chi_phi, 0) ELSE 0 END)",
        'suaChuaChungCogs',
      )
      .addSelect(
        "COUNT(CASE WHEN c.classification = 'SUA_CHUA_CHUNG' THEN c.id END)",
        'suaChuaChungCaseCount',
      )
      // Phân khúc OJ
      .addSelect(
        "SUM(CASE WHEN c.classification IN ('OJ', 'OJ_NGOAI') THEN COALESCE(gp.doanh_thu, c.doanh_thu, c.tien_co_thue, 0) ELSE 0 END)",
        'ojRevenue',
      )
      .addSelect(
        "SUM(CASE WHEN c.classification IN ('OJ', 'OJ_NGOAI') THEN COALESCE(gp.chi_phi, c.chi_phi, 0) ELSE 0 END)",
        'ojCogs',
      )
      .addSelect(
        "COUNT(CASE WHEN c.classification IN ('OJ', 'OJ_NGOAI') THEN 1 END)",
        'ojCaseCount',
      )
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

    const kyGuiRevenue = Number(rawAgg?.kyGuiRevenue) || 0;
    const kyGuiCogs = Number(rawAgg?.kyGuiCogs) || 0;
    const kyGuiCaseCount = Number(rawAgg?.kyGuiCaseCount) || 0;
    const kyGuiGrossProfit = kyGuiRevenue - kyGuiCogs;

    const suaChuaChungRevenue = Number(rawAgg?.suaChuaChungRevenue) || 0;
    const suaChuaChungCogs = Number(rawAgg?.suaChuaChungCogs) || 0;
    const suaChuaChungCaseCount = Number(rawAgg?.suaChuaChungCaseCount) || 0;
    const suaChuaChungGrossProfit = suaChuaChungRevenue - suaChuaChungCogs;

    const ojRevenue = Number(rawAgg?.ojRevenue) || 0;
    const ojCogsDirect = Number(rawAgg?.ojCogs) || 0;
    const ojCaseCount = Number(rawAgg?.ojCaseCount) || 0;

    // 2. Lấy Chi phí vận hành, Hoa hồng & Chi phí trực tiếp nhập tay từ GarageOpexService
    const opexSummary = await this.opexService.getSummaryByPeriod(
      currentYear,
      currentMonth,
    );

    const cogs = cogsDirect + opexSummary.directCost.total;
    const grossProfit = revenue - cogs;

    const netProfitBeforeCommission = grossProfit - opexSummary.opex.total;

    // 3. Tính toán Tỷ lệ lãi gộp Ký gửi / Tổng Lãi gộp (R_kg)
    // Tỷ lệ = GP_kg / GP (0..100%) khi GP > 0 và GP_kg > 0
    const kyGuiProfitRate =
      grossProfit > 0 && kyGuiGrossProfit > 0
        ? (kyGuiGrossProfit / grossProfit) * 100
        : 0;
    const kyGuiProfitRatioDecimal = kyGuiProfitRate / 100;

    // 4. Tính toán Hoa hồng tự động theo chuẩn công thức P&L:
    // Hoa hồng cho Sale (10%): Tính trên 10% của Lợi nhuận ròng theo Tỷ lệ lợi nhuận gộp do ký gửi / tổng lợi nhuận gộp
    const saleCommissionRate = 0.1;
    const saleCommission =
      netProfitBeforeCommission > 0
        ? Math.round(
            netProfitBeforeCommission *
              kyGuiProfitRatioDecimal *
              saleCommissionRate,
          )
        : 0;

    // Hoa hồng cho DV (10%): Tính trên 10% Lợi nhuận ròng sau khi trừ hoa hồng Sale
    const dvCommissionRate = 0.1;
    const dvCommission =
      netProfitBeforeCommission > 0
        ? Math.round(
            (netProfitBeforeCommission - saleCommission) * dvCommissionRate,
          )
        : 0;

    const totalAutoCommission = saleCommission + dvCommission;

    // Các khoản hoa hồng nhập tay thủ công khác (như HOA_HONG_KHAC, có thể âm hoặc dương)
    const manualCommissionItems = (opexSummary.commission?.items || []).filter(
      (item) =>
        item.categoryKey !== 'HOA_HONG_SALE' &&
        item.categoryKey !== 'HOA_HONG_DV',
    );
    const manualCommissionTotal = manualCommissionItems.reduce(
      (sum, item) => sum + (Number(item.amount) || 0),
      0,
    );
    const manualCommissionOjTotal = manualCommissionItems.reduce(
      (sum, item) => sum + (Number(item.ojAmount) || 0),
      0,
    );

    const totalCommission =
      saleCommission + dvCommission + manualCommissionTotal;
    const netProfitAfterCommission =
      netProfitBeforeCommission - totalCommission;

    // 5. Tính toán riêng cho phân khúc OJ
    const ojDirectCostTotal = opexSummary.directCost.ojTotal || 0;
    const ojCogs = ojCogsDirect + ojDirectCostTotal;
    const ojGrossProfit = ojRevenue - ojCogs;
    const ojOpexTotal = opexSummary.opex.ojTotal || 0;
    const ojNetProfitBeforeCommission = ojGrossProfit - ojOpexTotal;

    // Commission cho OJ
    const ojSaleCommission = 0; // OJ không tính ký gửi
    const ojDvCommission =
      ojNetProfitBeforeCommission > 0
        ? Math.round(ojNetProfitBeforeCommission * dvCommissionRate)
        : 0;
    const ojCommissionTotal =
      ojSaleCommission + ojDvCommission + manualCommissionOjTotal;
    const ojNetProfitAfterCommission =
      ojNetProfitBeforeCommission - ojCommissionTotal;

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

      // Chi tiết mảng Ký gửi / Nội bộ (từ kgara_cases.classification)
      kyGui: {
        caseCount: kyGuiCaseCount,
        revenue: kyGuiRevenue,
        cogs: kyGuiCogs,
        grossProfit: kyGuiGrossProfit,
        grossProfitRatio: kyGuiProfitRate,
      },

      // Chi tiết mảng Sửa chữa chung
      suaChuaChung: {
        caseCount: suaChuaChungCaseCount,
        revenue: suaChuaChungRevenue,
        cogs: suaChuaChungCogs,
        grossProfit: suaChuaChungGrossProfit,
      },

      opex: opexSummary.opex,
      netProfitBeforeCommission,

      commission: {
        total: totalCommission,
        ojTotal: ojCommissionTotal,
        // Cấu trúc tự động tính toán
        auto: {
          kyGuiGrossProfit,
          totalGrossProfit: grossProfit,
          kyGuiProfitRate,
          saleCommissionRate: 10,
          saleCommission,
          dvCommissionRate: 10,
          dvCommission,
          totalAuto: totalAutoCommission,
        },
        // Các khoản nhập tay thủ công khác (nếu có)
        manual: {
          total: manualCommissionTotal,
          ojTotal: manualCommissionOjTotal,
          items: manualCommissionItems,
        },
        items: [
          {
            categoryKey: 'RATE_LAI_GOP_KY_GUI',
            categoryName: 'Tỷ lệ lãi gộp ký gửi / Lãi gộp',
            amount: kyGuiProfitRate,
            ojAmount: 0,
            note: `Lãi gộp Ký gửi: ${kyGuiGrossProfit.toLocaleString('vi-VN')} đ / Tổng lãi gộp: ${grossProfit.toLocaleString('vi-VN')} đ`,
          },
          {
            categoryKey: 'HOA_HONG_SALE',
            categoryName: 'Hoa hồng cho Sale (10%)',
            amount: saleCommission,
            ojAmount: 0,
            isAutoCalculated: true,
            isReadOnly: true,
            note: 'Tính trên 10% của Lợi nhuận ròng theo Tỷ lệ lợi nhuận gộp do ký gửi / tổng lợi nhuận gộp',
          },
          {
            categoryKey: 'HOA_HONG_DV',
            categoryName: 'Hoa hồng cho DV (10%)',
            amount: dvCommission,
            ojAmount: ojDvCommission,
            isAutoCalculated: true,
            isReadOnly: true,
            note: 'Tính trên 10% Lợi nhuận ròng sau khi trừ hoa hồng Sale',
          },
          ...manualCommissionItems,
        ],
      },
      netProfitAfterCommission,
      netMarginRate:
        revenue > 0 ? (netProfitAfterCommission / revenue) * 100 : 0,
      oj: {
        caseCount: ojCaseCount,
        revenue: ojRevenue,
        revenueRatio: revenue > 0 ? (ojRevenue / revenue) * 100 : 0,
        cogs: ojCogs,
        cogsDirect: ojCogsDirect,
        cogsAdjustmentTotal: ojDirectCostTotal,
        grossProfit: ojGrossProfit,
        grossMarginRate: ojRevenue > 0 ? (ojGrossProfit / ojRevenue) * 100 : 0,
        opexTotal: ojOpexTotal,
        netProfitBeforeCommission: ojNetProfitBeforeCommission,
        commissionTotal: ojCommissionTotal,
        commissionAuto: {
          kyGuiProfitRate: 0,
          saleCommission: ojSaleCommission,
          dvCommission: ojDvCommission,
          totalAuto: ojDvCommission,
        },
        netProfitAfterCommission: ojNetProfitAfterCommission,
        netMarginRate:
          ojRevenue > 0 ? (ojNetProfitAfterCommission / ojRevenue) * 100 : 0,
      },
    };
  }

  /**
   * Lấy danh sách CP Vận hành kết hợp (kèm 2 dòng Hoa hồng Sale & DV tính toán tự động)
   */
  async getCombinedOpexList(query: ListGarageOpexQueryDto) {
    const dbResult = await this.opexService.getList(query);

    // Nếu filter chỉ lấy OPEX hoặc COGS thì không cần inject hoa hồng tự động
    if (query.cost_group === 'OPEX' || query.cost_group === 'COGS') {
      return dbResult;
    }

    // Xác định các kỳ (Year/Month) cần tính hoa hồng tự động
    const periodsToCompute: Array<{ year: number; month: number }> = [];

    if (query.year && query.month) {
      periodsToCompute.push({
        year: Number(query.year),
        month: Number(query.month),
      });
    } else if (query.date_from && query.date_to) {
      const [fromY, fromM] = query.date_from.split('-').map(Number);
      const [toY, toM] = query.date_to.split('-').map(Number);
      if (fromY === toY && fromM === toM) {
        periodsToCompute.push({ year: fromY, month: fromM || 1 });
      } else {
        // Range: duyệt các tháng
        let curY = fromY;
        let curM = fromM || 1;
        const endY = toY;
        const endM = toM || 12;
        while (curY < endY || (curY === endY && curM <= endM)) {
          periodsToCompute.push({ year: curY, month: curM });
          curM++;
          if (curM > 12) {
            curM = 1;
            curY++;
          }
        }
      }
    } else {
      // Nếu không có filter kỳ, lấy từ dbResult hoặc tháng hiện tại
      const foundPeriods = new Set<string>();
      for (const item of dbResult.data) {
        foundPeriods.add(`${item.periodYear}-${item.periodMonth}`);
      }
      if (foundPeriods.size === 0) {
        const now = new Date();
        periodsToCompute.push({
          year: now.getFullYear(),
          month: now.getMonth() + 1,
        });
      } else {
        for (const p of foundPeriods) {
          const [y, m] = p.split('-').map(Number);
          periodsToCompute.push({ year: y, month: m });
        }
      }
    }

    const virtualItems: any[] = [];

    for (const p of periodsToCompute) {
      const pnl = await this.getPnlReport(p.year, p.month);

      const autoSale = {
        id: `auto-sale-${p.year}-${String(p.month).padStart(2, '0')}`,
        periodYear: p.year,
        periodMonth: p.month,
        period: `${String(p.month).padStart(2, '0')}/${p.year}`,
        categoryKey: 'HOA_HONG_SALE',
        categoryName: 'Hoa hồng cho Sale (10%)',
        amount: pnl.commission.auto.saleCommission,
        ojAmount: 0,
        note: `Tự động tính từ P&L (${pnl.commission.auto.kyGuiProfitRate.toFixed(1)}% tỷ lệ ký gửi, LN ròng trước HH: ${pnl.netProfitBeforeCommission.toLocaleString('vi-VN')} đ)`,
        recurrenceType: null,
        recurrenceUntilYear: null,
        recurrenceUntilMonth: null,
        recurrenceAnchorId: null,
        isAutoCalculated: true,
        isReadOnly: true,
        createdAt: new Date(
          `${p.year}-${String(p.month).padStart(2, '0')}-01T00:00:00.000Z`,
        ),
        updatedAt: new Date(),
      };

      const autoDv = {
        id: `auto-dv-${p.year}-${String(p.month).padStart(2, '0')}`,
        periodYear: p.year,
        periodMonth: p.month,
        period: `${String(p.month).padStart(2, '0')}/${p.year}`,
        categoryKey: 'HOA_HONG_DV',
        categoryName: 'Hoa hồng cho DV (10%)',
        amount: pnl.commission.auto.dvCommission,
        ojAmount: pnl.oj?.commissionAuto?.dvCommission || 0,
        note: `Tự động tính từ P&L (10% LN ròng sau trừ HH Sale: ${(pnl.netProfitBeforeCommission - pnl.commission.auto.saleCommission).toLocaleString('vi-VN')} đ)`,
        recurrenceType: null,
        recurrenceUntilYear: null,
        recurrenceUntilMonth: null,
        recurrenceAnchorId: null,
        isAutoCalculated: true,
        isReadOnly: true,
        createdAt: new Date(
          `${p.year}-${String(p.month).padStart(2, '0')}-01T00:00:00.000Z`,
        ),
        updatedAt: new Date(),
      };

      // Kiểm tra filter theo query
      const candidates = [autoSale, autoDv];
      for (const item of candidates) {
        let match = true;
        if (query.column_filters) {
          try {
            const filters = JSON.parse(query.column_filters) as Record<
              string,
              string[]
            >;
            if (filters.categoryKey && filters.categoryKey.length > 0) {
              if (!filters.categoryKey.includes(item.categoryKey))
                match = false;
            }
            if (filters.categoryName && filters.categoryName.length > 0) {
              if (!filters.categoryName.includes(item.categoryName))
                match = false;
            }
            if (filters.costGroup && filters.costGroup.length > 0) {
              if (!filters.costGroup.includes('COMMISSION')) match = false;
            }
          } catch (e) {}
        }
        if (match) {
          virtualItems.push(item);
        }
      }
    }

    // Gộp virtualItems vào kết quả và sort
    const combinedData = [...virtualItems, ...dbResult.data];
    const total = dbResult.total + virtualItems.length;
    const pageSize = Math.max(Number(query.pageSize) || 20, 1);

    return {
      data: combinedData,
      total,
      page: Math.max(Number(query.page) || 1, 1),
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Lấy chi tiết bản ghi ảo hoa hồng tự động
   */
  async getVirtualOpexById(id: string) {
    if (id.startsWith('auto-sale-') || id.startsWith('auto-dv-')) {
      const isSale = id.startsWith('auto-sale-');
      const parts = id.split('-');
      const year = parseInt(parts[2], 10);
      const month = parseInt(parts[3], 10);
      const report = await this.getPnlReport(year, month);

      if (isSale) {
        return {
          id,
          periodYear: year,
          periodMonth: month,
          period: `${String(month).padStart(2, '0')}/${year}`,
          categoryKey: 'HOA_HONG_SALE',
          categoryName: 'Hoa hồng cho Sale (10%)',
          amount: report.commission.auto.saleCommission,
          ojAmount: 0,
          note: `Tự động tính từ P&L (${report.commission.auto.kyGuiProfitRate.toFixed(1)}% tỷ lệ ký gửi, LN ròng trước HH: ${report.netProfitBeforeCommission.toLocaleString('vi-VN')} đ)`,
          recurrenceType: null,
          recurrenceUntilYear: null,
          recurrenceUntilMonth: null,
          recurrenceAnchorId: null,
          isAutoCalculated: true,
          isReadOnly: true,
          createdAt: new Date(
            `${year}-${String(month).padStart(2, '0')}-01T00:00:00.000Z`,
          ),
          updatedAt: new Date(),
        };
      } else {
        return {
          id,
          periodYear: year,
          periodMonth: month,
          period: `${String(month).padStart(2, '0')}/${year}`,
          categoryKey: 'HOA_HONG_DV',
          categoryName: 'Hoa hồng cho DV (10%)',
          amount: report.commission.auto.dvCommission,
          ojAmount: report.oj?.commissionAuto?.dvCommission || 0,
          note: `Tự động tính từ P&L (10% LN ròng sau trừ HH Sale: ${(report.netProfitBeforeCommission - report.commission.auto.saleCommission).toLocaleString('vi-VN')} đ)`,
          recurrenceType: null,
          recurrenceUntilYear: null,
          recurrenceUntilMonth: null,
          recurrenceAnchorId: null,
          isAutoCalculated: true,
          isReadOnly: true,
          createdAt: new Date(
            `${year}-${String(month).padStart(2, '0')}-01T00:00:00.000Z`,
          ),
          updatedAt: new Date(),
        };
      }
    }
    return this.opexService.getById(id);
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
        header: 'Toàn Bộ (VND)',
        key: 'amount',
        width: 24,
      },
      {
        header: 'Riêng OJ (VND)',
        key: 'ojAmount',
        width: 24,
      },
    ];

    // Tiêu đề lớn
    sheet.spliceRows(1, 0, [
      `BÁO CÁO LỢI NHUẬN (P&L) GARAGE - THÁNG ${String(report.period.month).padStart(2, '0')}/${report.period.year}`,
      '',
      '',
    ]);
    sheet.mergeCells('A1:C1');
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
      ojAmount?: number | string;
      isHeader?: boolean;
      isHighlight?: boolean;
      isSuccess?: boolean;
      isChild?: boolean;
      isRate?: boolean;
    }> = [
      {
        category: 'I. Doanh Thu',
        amount: report.revenue,
        ojAmount: report.oj?.revenue || 0,
        isHeader: true,
      },
      {
        category: '   Doanh Thu Dịch Vụ',
        amount: report.revenue,
        ojAmount: report.oj?.revenue || 0,
        isChild: true,
      },
      {
        category: 'II. Chi phí (Giá vốn)',
        amount: report.cogs,
        ojAmount: report.oj?.cogs || 0,
        isHeader: true,
      },
      {
        category: '   Chi phí phụ tùng & Gia công ngoài',
        amount: report.cogsDirect,
        ojAmount: report.oj?.cogsDirect || 0,
        isChild: true,
      },
    ];

    if (report.cogsAdjustment && report.cogsAdjustment.items.length > 0) {
      for (const item of report.cogsAdjustment.items) {
        rowsData.push({
          category: `   ${item.categoryName}`,
          amount: item.amount,
          ojAmount: item.ojAmount || 0,
          isChild: true,
        });
      }
    }

    rowsData.push(
      {
        category: 'III. Lợi nhuận gộp',
        amount: report.grossProfit,
        ojAmount: report.oj?.grossProfit || 0,
        isHighlight: true,
      },
      {
        category: 'IV. Chi phí vận hành',
        amount: report.opex.total,
        ojAmount: report.oj?.opexTotal || 0,
        isHeader: true,
      },
    );

    if (report.opex.items.length === 0) {
      rowsData.push({
        category: '   (Chưa nhập chi phí vận hành)',
        amount: 0,
        ojAmount: 0,
        isChild: true,
      });
    } else {
      for (const item of report.opex.items) {
        rowsData.push({
          category: `   ${item.categoryName}`,
          amount: item.amount,
          ojAmount: item.ojAmount || 0,
          isChild: true,
        });
      }
    }

    rowsData.push({
      category: 'V. Lợi nhuận ròng (trước hoa hồng)',
      amount: report.netProfitBeforeCommission,
      ojAmount: report.oj?.netProfitBeforeCommission || 0,
      isHighlight: true,
    });

    rowsData.push({
      category: 'VI. Hoa hồng',
      amount: report.commission.total,
      ojAmount: report.oj?.commissionTotal || 0,
      isHeader: true,
    });

    // Các dòng con của Hoa hồng: Tỷ lệ Ký gửi, Hoa hồng Sale, Hoa hồng DV
    rowsData.push({
      category: '   Tỷ lệ lãi gộp ký gửi / Lãi gộp',
      amount: `${report.commission.auto.kyGuiProfitRate.toFixed(2)}%`,
      ojAmount: '0.00%',
      isChild: true,
      isRate: true,
    });

    rowsData.push({
      category: '   Hoa hồng cho Sale (10%)',
      amount: report.commission.auto.saleCommission,
      ojAmount: report.oj?.commissionAuto?.saleCommission || 0,
      isChild: true,
    });

    rowsData.push({
      category: '   Hoa hồng cho DV (10%)',
      amount: report.commission.auto.dvCommission,
      ojAmount: report.oj?.commissionAuto?.dvCommission || 0,
      isChild: true,
    });

    if (report.commission.manual && report.commission.manual.items.length > 0) {
      for (const item of report.commission.manual.items) {
        rowsData.push({
          category: `   ${item.categoryName}`,
          amount: item.amount,
          ojAmount: item.ojAmount || 0,
          isChild: true,
        });
      }
    }

    rowsData.push({
      category: 'VII. Lợi nhuận ròng (sau hoa hồng)',
      amount: report.netProfitAfterCommission,
      ojAmount: report.oj?.netProfitAfterCommission || 0,
      isSuccess: true,
    });

    for (const r of rowsData) {
      const addedRow = sheet.addRow({
        category: r.category,
        amount: r.amount,
        ojAmount: r.ojAmount !== undefined ? r.ojAmount : 0,
      });
      addedRow.height = 22;

      // Định dạng cell số
      const amountCell = addedRow.getCell(2);
      const ojAmountCell = addedRow.getCell(3);

      if (typeof r.amount === 'number') {
        amountCell.numFmt = '#,##0';
      } else {
        amountCell.alignment = { horizontal: 'right', vertical: 'middle' };
      }

      if (typeof r.ojAmount === 'number') {
        ojAmountCell.numFmt = '#,##0';
      } else {
        ojAmountCell.alignment = { horizontal: 'right', vertical: 'middle' };
      }

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
