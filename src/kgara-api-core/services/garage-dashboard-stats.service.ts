import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KgaraCase } from '../entities/kgara_case.entity';
import { KgaraGrossProfit } from '../entities/kgara_gross_profit.entity';
import { KgaraCaseSettlement } from '../entities/kgara_case_settlement.entity';
import { format, subMonths } from 'date-fns';

@Injectable()
export class GarageDashboardStatsService {
  private readonly logger = new Logger(GarageDashboardStatsService.name);

  constructor(
    @InjectRepository(KgaraCase)
    private readonly caseRepo: Repository<KgaraCase>,
    @InjectRepository(KgaraCaseSettlement)
    private readonly settlementRepo: Repository<KgaraCaseSettlement>,
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

      const existingInMonth = statusDistributionByMonth[m].find(
        (item) => item.statusName === statusName,
      );
      if (existingInMonth) {
        existingInMonth.count += cnt;
        existingInMonth.revenue += rev;
      } else {
        statusDistributionByMonth[m].push({
          statusCode,
          statusName,
          count: cnt,
          revenue: rev,
        });
      }
      statusTotalCountByMonth[m] += cnt;
      statusTotalRevenueByMonth[m] += rev;

      const key = statusName;
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
}
