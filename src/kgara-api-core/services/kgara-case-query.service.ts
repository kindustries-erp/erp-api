import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder, Brackets, In } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { KgaraCase } from '../entities/kgara_case.entity';
import { KgaraCaseSettlement } from '../entities/kgara_case_settlement.entity';
import { KgaraCaseService } from '../entities/kgara_case_service.entity';
import { KgaraBranch } from '../entities/kgara_branch.entity';
import { KgaraGrossProfit } from '../entities/kgara_gross_profit.entity';
import { KgaraCaseLinkedInvoice } from '../entities/kgara_case_linked_invoice.entity';
import { KgaraClientService } from '../kgara-client.service';
import { applyMultiKeywordFilter } from '../../common/utils/query-builder.util';
import { extractNetPayableAmount } from '../kgara-sync.service';

export interface CompletedCasesExportParams {
  branchId?: string;
  date_from?: string;
  date_to?: string;
  date_type?: 'completion_date' | 'case_date';
  classification?: string;
  status?: string;
  q?: string;
}

@Injectable()
export class KgaraCaseQueryService {
  private readonly logger = new Logger(KgaraCaseQueryService.name);

  constructor(
    @InjectRepository(KgaraCase)
    private readonly caseRepo: Repository<KgaraCase>,
    @InjectRepository(KgaraCaseSettlement)
    private readonly settlementRepo: Repository<KgaraCaseSettlement>,
    @Optional()
    @InjectRepository(KgaraCaseService)
    private readonly serviceRepo?: Repository<KgaraCaseService>,
    @Optional()
    @InjectRepository(KgaraBranch)
    private readonly branchRepo?: Repository<KgaraBranch>,
    @Optional()
    @InjectRepository(KgaraGrossProfit)
    private readonly grossProfitRepo?: Repository<KgaraGrossProfit>,
    @Optional()
    @InjectRepository(KgaraCaseLinkedInvoice)
    private readonly linkedInvoiceRepo?: Repository<KgaraCaseLinkedInvoice>,
    @Optional()
    private readonly client?: KgaraClientService,
  ) {}

  getCaseColumnSelectExpr(column: string): string | null {
    const mapping: Record<string, string> = {
      caseCode: '"case"."so_chung_tu"',
      soChungTu: '"case"."so_chung_tu"',
      licensePlate: '"case"."bien_so_xe"',
      bienSoXe: '"case"."bien_so_xe"',
      customer:
        'CONCAT(COALESCE("case"."khach_hang_name", \'\'), \' \', COALESCE("case"."khach_hang_code", \'\'))',
      customerCode: '"case"."khach_hang_code"',
      khachHangCode: '"case"."khach_hang_code"',
      customerName: '"case"."khach_hang_name"',
      khachHangName: '"case"."khach_hang_name"',
      statusName: '"case"."ten_tinh_trang_dich_vu"',
      classification: '"case"."classification"',
      kgaraClassification: '"case"."kgara_classification"',
      kgaraClassificationCode: '"case"."kgara_classification_code"',
      branchName: '"case"."branch_external_id"',
      branchExternalId: '"case"."branch_external_id"',
      isInsuranceClaim:
        "CASE WHEN COALESCE((\"case\".\"raw_data\" ->> 'XeLamBaoHiem')::boolean, false) THEN 'yes' ELSE 'no' END",
      doanhThu:
        'COALESCE("case"."doanh_thu", "gp"."doanh_thu", "case"."tien_co_thue")',
      chiPhi: 'COALESCE("case"."chi_phi", "gp"."chi_phi")',
      loiNhuan:
        'COALESCE("case"."loi_nhuan", "gp"."loi_nhuan", COALESCE("case"."doanh_thu", "gp"."doanh_thu", "case"."tien_co_thue", 0) - COALESCE("case"."chi_phi", "gp"."chi_phi", 0))',
      margin:
        'CASE WHEN COALESCE("case"."doanh_thu", "gp"."doanh_thu", "case"."tien_co_thue", 0) > 0 THEN ROUND(((COALESCE("case"."loi_nhuan", "gp"."loi_nhuan", COALESCE("case"."doanh_thu", "gp"."doanh_thu", "case"."tien_co_thue", 0) - COALESCE("case"."chi_phi", "gp"."chi_phi", 0)) / COALESCE("case"."doanh_thu", "gp"."doanh_thu", "case"."tien_co_thue")) * 100)::numeric, 1) ELSE 0 END',
      bienLoiNhuan:
        'CASE WHEN COALESCE("case"."doanh_thu", "gp"."doanh_thu", "case"."tien_co_thue", 0) > 0 THEN ROUND(((COALESCE("case"."loi_nhuan", "gp"."loi_nhuan", COALESCE("case"."doanh_thu", "gp"."doanh_thu", "case"."tien_co_thue", 0) - COALESCE("case"."chi_phi", "gp"."chi_phi", 0)) / COALESCE("case"."doanh_thu", "gp"."doanh_thu", "case"."tien_co_thue")) * 100)::numeric, 1) ELSE 0 END',
      totalAmount: '"case"."tien_co_thue"',
      tienCoThue: '"case"."tien_co_thue"',
      tongPhaiThu: '"case"."tien_co_thue"',
      totalReceivable: '"case"."tien_co_thue"',
      paidAmount: '"case"."tien_da_thanh_toan"',
      tienDaThanhToan: '"case"."tien_da_thanh_toan"',
      balanceAmount: '"case"."tien_con_phai_thanh_toan"',
      tienConPhaiThanhToan: '"case"."tien_con_phai_thanh_toan"',
      conPhaiThu: '"case"."tien_con_phai_thanh_toan"',
      remainingReceivable: '"case"."tien_con_phai_thanh_toan"',
      tongPhaiTra: 'COALESCE("case"."chi_phi", "gp"."chi_phi")',
      totalPayable: 'COALESCE("case"."chi_phi", "gp"."chi_phi")',
      tienConPhaiChi: 'COALESCE("case"."chi_phi", "gp"."chi_phi")',
      conPhaiTra: 'COALESCE("case"."chi_phi", "gp"."chi_phi")',
      remainingPayable: 'COALESCE("case"."chi_phi", "gp"."chi_phi")',
      caseDate:
        'TO_CHAR(COALESCE("case"."ngay_tiep_nhan", "case"."ngay_phat_sinh"), \'YYYY-MM-DD\')',
      ngayPhatSinh: 'TO_CHAR("case"."ngay_phat_sinh", \'YYYY-MM-DD\')',
      ngayTiepNhan:
        'TO_CHAR(COALESCE("case"."ngay_tiep_nhan", "case"."ngay_phat_sinh"), \'YYYY-MM-DD\')',
      ngayHoanThanhCongViec:
        'TO_CHAR("case"."ngay_hoan_thanh_cong_viec", \'YYYY-MM-DD\')',
      completionDate:
        'TO_CHAR("case"."ngay_hoan_thanh_cong_viec", \'YYYY-MM-DD\')',
      hasInvoice:
        'CASE WHEN (COALESCE(("case"."raw_data" ->> \'DaTaoHoaDonThue\')::boolean, false) OR (("case"."raw_data" ->> \'TienThueKH\') IS NOT NULL AND ("case"."raw_data" ->> \'TienThueKH\') ~ \'^[0-9.]+$\' AND ("case"."raw_data" ->> \'TienThueKH\')::numeric > 0) OR (("case"."raw_data" ->> \'TienThue\') IS NOT NULL AND ("case"."raw_data" ->> \'TienThue\') ~ \'^[0-9.]+$\' AND ("case"."raw_data" ->> \'TienThue\')::numeric > 0)) THEN \'YES\' ELSE \'NO\' END',
      vatInvoice:
        'CASE WHEN (COALESCE(("case"."raw_data" ->> \'DaTaoHoaDonThue\')::boolean, false) OR (("case"."raw_data" ->> \'TienThueKH\') IS NOT NULL AND ("case"."raw_data" ->> \'TienThueKH\') ~ \'^[0-9.]+$\' AND ("case"."raw_data" ->> \'TienThueKH\')::numeric > 0) OR (("case"."raw_data" ->> \'TienThue\') IS NOT NULL AND ("case"."raw_data" ->> \'TienThue\') ~ \'^[0-9.]+$\' AND ("case"."raw_data" ->> \'TienThue\')::numeric > 0)) THEN \'YES\' ELSE \'NO\' END',
      hasLinkedInvoice:
        'CASE WHEN EXISTS (SELECT 1 FROM kgara_case_linked_invoice l WHERE l."caseDbId" = "case".id) THEN \'YES\' ELSE \'NO\' END',
      updatedAt: 'TO_CHAR("case"."updated_at", \'YYYY-MM-DD\')',
      dataAsOf: 'TO_CHAR("case"."data_as_of", \'YYYY-MM-DD\')',
      createdAt: 'TO_CHAR("case"."created_at", \'YYYY-MM-DD\')',
    };

    return mapping[column] || null;
  }

  applySingleCaseColumnFilter(
    qb: SelectQueryBuilder<KgaraCase>,
    column: string,
    values: string[],
    paramPrefix: string,
  ) {
    if (!values || values.length === 0) return;

    // 0. Xử lý khoảng ngày (Date Range: "YYYY-MM-DD..YYYY-MM-DD" hoặc "YYYY-MM-DD|YYYY-MM-DD")
    if (
      values.length === 1 &&
      (values[0].includes('..') || values[0].includes('|'))
    ) {
      const separator = values[0].includes('..') ? '..' : '|';
      const [fromDate, toDate] = values[0].split(separator);
      const filterExpr = this.getCaseColumnSelectExpr(column);
      if (filterExpr) {
        if (fromDate) {
          qb.andWhere(`${filterExpr} >= :${paramPrefix}_from_date`, {
            [`${paramPrefix}_from_date`]: fromDate,
          });
        }
        if (toDate) {
          qb.andWhere(`${filterExpr} <= :${paramPrefix}_to_date`, {
            [`${paramPrefix}_to_date`]: toDate,
          });
        }
        return;
      }
    }

    // 1. Xử lý __ALL_MATCHING__ (Chọn tất cả kết quả tìm kiếm)
    if (values[0] === '__ALL_MATCHING__') {
      const searchStr = (values[1] || '').trim();
      if (!searchStr) return;
      const filterExpr = this.getCaseColumnSelectExpr(column);
      if (filterExpr) {
        applyMultiKeywordFilter(
          qb,
          `CAST(${filterExpr} AS TEXT)`,
          searchStr,
          `${paramPrefix}_search`,
        );
      }
      return;
    }

    // 2. Cột đặc thù: collectionProgress (Tiến độ thu)
    if (column === 'collectionProgress') {
      const conditions: string[] = [];
      if (values.includes('PAID')) {
        conditions.push(
          '(COALESCE(case.tienConPhaiThanhToan, 0) <= 0 AND COALESCE(case.tienDaThanhToan, 0) > 0)',
        );
      }
      if (values.includes('PARTIAL')) {
        conditions.push(
          '(COALESCE(case.tienDaThanhToan, 0) > 0 AND COALESCE(case.tienConPhaiThanhToan, 0) > 0)',
        );
      }
      if (values.includes('UNPAID')) {
        conditions.push(
          '(COALESCE(case.tienDaThanhToan, 0) <= 0 AND COALESCE(case.tienConPhaiThanhToan, 0) > 0)',
        );
      }
      if (conditions.length > 0) {
        qb.andWhere(`(${conditions.join(' OR ')})`);
      }
      return;
    }

    // 3. Cột đặc thù: costProgress (Tiến độ chi)
    if (column === 'costProgress') {
      const conditions: string[] = [];
      if (values.includes('PAID')) {
        conditions.push(
          "(COALESCE(case.chiPhi, 0) > 0 AND COALESCE(case.chiPhi, 0) <= COALESCE((SELECT SUM(amount) FROM kgara_case_settlements WHERE case_id = case.id AND settlement_type = 'PAYMENT'), 0))",
        );
      }
      if (values.includes('PARTIAL')) {
        conditions.push(
          "(COALESCE((SELECT SUM(amount) FROM kgara_case_settlements WHERE case_id = case.id AND settlement_type = 'PAYMENT'), 0) > 0 AND COALESCE(case.chiPhi, 0) > COALESCE((SELECT SUM(amount) FROM kgara_case_settlements WHERE case_id = case.id AND settlement_type = 'PAYMENT'), 0))",
        );
      }
      if (values.includes('UNPAID')) {
        conditions.push(
          "(COALESCE(case.chiPhi, 0) > 0 AND COALESCE((SELECT SUM(amount) FROM kgara_case_settlements WHERE case_id = case.id AND settlement_type = 'PAYMENT'), 0) <= 0)",
        );
      }
      if (conditions.length > 0) {
        qb.andWhere(`(${conditions.join(' OR ')})`);
      }
      return;
    }

    // 4. Cột đặc thù: hasInvoice / vatInvoice (Có hóa đơn VAT theo thuế KGara)
    if (column === 'hasInvoice' || column === 'vatInvoice') {
      const conditions: string[] = [];
      const vatPositiveCondition =
        '(COALESCE(("case"."raw_data"->>\'DaTaoHoaDonThue\')::boolean, false) OR ("case"."raw_data"->>\'TienThueKH\' IS NOT NULL AND ("case"."raw_data"->>\'TienThueKH\') ~ \'^[0-9.]+$\' AND ("case"."raw_data"->>\'TienThueKH\')::numeric > 0) OR ("case"."raw_data"->>\'TienThue\' IS NOT NULL AND ("case"."raw_data"->>\'TienThue\') ~ \'^[0-9.]+$\' AND ("case"."raw_data"->>\'TienThue\')::numeric > 0))';
      if (values.includes('YES') || values.includes('WITH_INVOICE')) {
        conditions.push(vatPositiveCondition);
      }
      if (values.includes('NO') || values.includes('NO_INVOICE')) {
        conditions.push(`NOT ${vatPositiveCondition}`);
      }
      if (conditions.length > 0) {
        qb.andWhere(`(${conditions.join(' OR ')})`);
      }
      return;
    }

    // 5. Cột đặc thù: hasLinkedInvoice (Đã liên kết hóa đơn điện tử trong ERP)
    if (column === 'hasLinkedInvoice') {
      const conditions: string[] = [];
      if (values.includes('YES')) {
        conditions.push(
          'EXISTS (SELECT 1 FROM kgara_case_linked_invoice l WHERE l."caseDbId" = "case".id)',
        );
      }
      if (values.includes('NO')) {
        conditions.push(
          'NOT EXISTS (SELECT 1 FROM kgara_case_linked_invoice l WHERE l."caseDbId" = "case".id)',
        );
      }
      if (conditions.length > 0) {
        qb.andWhere(`(${conditions.join(' OR ')})`);
      }
      return;
    }

    // 6. Cột đặc thù: statusTab (Table Switch: quotation, in_progress, completed)
    if (column === 'statusTab') {
      const conditions: string[] = [];
      if (values.includes('quotation')) {
        conditions.push(
          '("case"."tinh_trang_dich_vu" = 1 OR "case"."ten_tinh_trang_dich_vu" ILIKE \'%báo giá%\' OR "case"."ten_tinh_trang_dich_vu" ILIKE \'%nháp%\' OR "case"."ten_tinh_trang_dich_vu" ILIKE \'%chờ%\')',
        );
      }
      if (values.includes('in_progress')) {
        conditions.push(
          '(("case"."tinh_trang_dich_vu" IN (0, 2) OR "case"."ten_tinh_trang_dich_vu" ILIKE \'%đang sửa%\' OR "case"."ten_tinh_trang_dich_vu" ILIKE \'%đang làm%\' OR "case"."ten_tinh_trang_dich_vu" ILIKE \'%tiếp nhận%\' OR "case"."ten_tinh_trang_dich_vu" ILIKE \'%đang xử lý%\' OR "case"."ten_tinh_trang_dich_vu" ILIKE \'%kiểm tra%\' OR "case"."ten_tinh_trang_dich_vu" ILIKE \'%sửa chữa%\' OR "case"."ten_tinh_trang_dich_vu" ILIKE \'%đang%\') AND NOT ("case"."tinh_trang_dich_vu" = 3 OR "case"."ten_tinh_trang_dich_vu" ILIKE \'%kết thúc%\' OR "case"."ten_tinh_trang_dich_vu" ILIKE \'%hoàn thành%\' OR "case"."ten_tinh_trang_dich_vu" ILIKE \'%hủy%\' OR "case"."ten_tinh_trang_dich_vu" ILIKE \'%từ chối%\'))',
        );
      }
      if (values.includes('completed')) {
        conditions.push(
          '("case"."tinh_trang_dich_vu" = 3 OR "case"."ten_tinh_trang_dich_vu" ILIKE \'%kết thúc%\' OR "case"."ten_tinh_trang_dich_vu" ILIKE \'%hoàn tất%\' OR "case"."ten_tinh_trang_dich_vu" ILIKE \'%hoàn thành%\' OR "case"."ten_tinh_trang_dich_vu" ILIKE \'%giao xe%\' OR "case"."ten_tinh_trang_dich_vu" ILIKE \'%xong%\' OR "case"."ten_tinh_trang_dich_vu" ILIKE \'%đã thanh toán%\')',
        );
      }
      if (conditions.length > 0) {
        qb.andWhere(`(${conditions.join(' OR ')})`);
      }
      return;
    }

    // 4. Cột đặc thù: margin / bienLoiNhuan (Biên lợi nhuận)
    if (column === 'margin' || column === 'bienLoiNhuan') {
      const marginExpr = `(CASE WHEN COALESCE("case"."doanh_thu", "gp"."doanh_thu", "case"."tien_co_thue", 0) > 0 THEN ((COALESCE("case"."loi_nhuan", "gp"."loi_nhuan", COALESCE("case"."doanh_thu", "gp"."doanh_thu", "case"."tien_co_thue", 0) - COALESCE("case"."chi_phi", "gp"."chi_phi", 0)) / COALESCE("case"."doanh_thu", "gp"."doanh_thu", "case"."tien_co_thue")) * 100) ELSE 0 END)`;

      const conditions: string[] = [];
      const hasBlank = values.includes('__BLANK__');
      const numericVals: number[] = [];

      for (const val of values) {
        if (val === 'HIGH') {
          conditions.push(`${marginExpr} >= 50`);
        } else if (val === 'MID') {
          conditions.push(`(${marginExpr} >= 20 AND ${marginExpr} < 50)`);
        } else if (val === 'LOW') {
          conditions.push(`(${marginExpr} >= 0 AND ${marginExpr} < 20)`);
        } else if (val === 'NEGATIVE') {
          conditions.push(`${marginExpr} < 0`);
        } else if (val !== '__BLANK__') {
          const num = Number(val);
          if (!isNaN(num)) {
            numericVals.push(num);
          }
        }
      }

      if (numericVals.length > 0) {
        conditions.push(
          `ROUND(${marginExpr}::numeric, 1) IN (:...${paramPrefix}_margin_vals)`,
        );
      }

      if (hasBlank) {
        conditions.push(
          `(COALESCE("case"."doanh_thu", "gp"."doanh_thu", "case"."tien_co_thue", 0) <= 0)`,
        );
      }

      if (conditions.length > 0) {
        qb.andWhere(`(${conditions.join(' OR ')})`, {
          [`${paramPrefix}_margin_vals`]: numericVals,
        });
      }
      return;
    }

    // 5. Cột số tiền: doanhThu, chiPhi, loiNhuan
    if (column === 'doanhThu' || column === 'chiPhi' || column === 'loiNhuan') {
      const filterExpr = this.getCaseColumnSelectExpr(column);
      if (!filterExpr) return;

      const hasBlank = values.includes('__BLANK__');
      const realVals = values.filter((v) => v !== '__BLANK__');
      const numericVals = realVals
        .map((v) => Number(v))
        .filter((v) => !isNaN(v));

      const conditions: string[] = [];
      if (hasBlank) {
        conditions.push(`(${filterExpr} IS NULL OR ${filterExpr} = 0)`);
      }
      if (numericVals.length > 0) {
        conditions.push(`${filterExpr} IN (:...${paramPrefix}_num_vals)`);
      }

      if (conditions.length > 0) {
        qb.andWhere(`(${conditions.join(' OR ')})`, {
          [`${paramPrefix}_num_vals`]: numericVals,
        });
      }
      return;
    }

    const filterExpr = this.getCaseColumnSelectExpr(column);
    if (!filterExpr) return;

    // 6. Xử lý __BLANK__ (Lọc giá trị trống / null)
    const hasBlank = values.includes('__BLANK__');
    const realVals = values.filter((v) => v !== '__BLANK__');

    if (hasBlank && realVals.length > 0) {
      qb.andWhere(
        `(${filterExpr} IS NULL OR CAST(${filterExpr} AS TEXT) = '' OR CAST(${filterExpr} AS TEXT) IN (:...${paramPrefix}_vals))`,
        { [`${paramPrefix}_vals`]: realVals },
      );
    } else if (hasBlank) {
      qb.andWhere(
        `(${filterExpr} IS NULL OR CAST(${filterExpr} AS TEXT) = '')`,
      );
    } else {
      qb.andWhere(`CAST(${filterExpr} AS TEXT) IN (:...${paramPrefix}_vals)`, {
        [`${paramPrefix}_vals`]: realVals,
      });
    }
  }

  applyCaseOptionFilters(
    qb: SelectQueryBuilder<KgaraCase>,
    activeColumn: string,
    filtersStr?: string,
  ) {
    if (!filtersStr) return;

    try {
      const filters = JSON.parse(filtersStr) as Record<string, string[]>;

      for (const [column, values] of Object.entries(filters)) {
        if (column === activeColumn) continue;
        if (!values || values.length === 0) continue;

        this.applySingleCaseColumnFilter(qb, column, values, `opt_${column}`);
      }
    } catch {
      // ignore malformed filter payloads
    }
  }

  applyCaseListFilters(qb: SelectQueryBuilder<KgaraCase>, filtersStr?: string) {
    if (!filtersStr) return;

    try {
      const filters = JSON.parse(filtersStr) as Record<string, string[]>;

      for (const [column, values] of Object.entries(filters)) {
        if (!values || values.length === 0) continue;

        this.applySingleCaseColumnFilter(qb, column, values, `list_${column}`);
      }
    } catch {
      // ignore malformed filter payloads
    }
  }

  async recalculateCaseSettlementSummary(caseId: string) {
    try {
      const c = await this.caseRepo.findOne({
        where: [
          { id: caseId },
          { soChungTu: caseId },
          { hdPhieuDichVuId: caseId },
        ],
      });
      if (!c) return;

      const settlements = await this.settlementRepo.find({
        where: { caseId: c.id },
      });

      const totalReceipts = settlements
        .filter((s) => s.settlementType === 'RECEIPT')
        .reduce((sum, s) => sum + Number(s.amount || 0), 0);

      const targetRevenue = extractNetPayableAmount(c);
      const remainingReceivable = Math.max(0, targetRevenue - totalReceipts);

      await this.caseRepo.update(c.id, {
        tienCoThue: targetRevenue,
        tienDaThanhToan: totalReceipts,
        tienConPhaiThanhToan: remainingReceivable,
      });
    } catch (err) {
      this.logger.warn(
        `Failed to recalculate case settlement summary for ${caseId}: ${err}`,
      );
    }
  }

  /**
   * Xuất danh sách Phiếu Dịch Vụ đã kết thúc theo kỳ ra file Excel (2 Sheets: Tổng quan phiếu & Chi tiết dịch vụ/phụ tùng)
   */
  async exportCompletedCasesExcel(
    params: CompletedCasesExportParams,
  ): Promise<Buffer> {
    const qb = this.caseRepo
      .createQueryBuilder('case')
      .leftJoinAndMapOne(
        'case.grossProfit',
        KgaraGrossProfit,
        'gp',
        'gp.hdPhieuDichVuId = case.hdPhieuDichVuId OR gp.vuViecCode = case.soChungTu',
      )
      .where('case.kgaraDeletedAt IS NULL');

    // 1. Phân loại trạng thái (mặc định xuất phiếu kết thúc/hoàn tất)
    if (params.status && params.status.toLowerCase() === 'all') {
      // Xuất tất cả các trạng thái không bị xóa
    } else {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('case.tinhTrangDichVu = 3')
            .orWhere('case.tenTinhTrangDichVu ILIKE :kwHoanTat', {
              kwHoanTat: '%hoàn tất%',
            })
            .orWhere('case.tenTinhTrangDichVu ILIKE :kwKetThuc', {
              kwKetThuc: '%kết thúc%',
            })
            .orWhere('case.ngayHoanThanhCongViec IS NOT NULL');
        }),
      ).andWhere('(case.tinhTrangDichVu IS NULL OR case.tinhTrangDichVu != 9)');
    }

    // 2. Lọc theo khoảng ngày
    const dateType = params.date_type || 'completion_date';
    const dateField =
      dateType === 'case_date'
        ? 'COALESCE(case.ngayTiepNhan, case.ngayPhatSinh)'
        : 'case.ngayHoanThanhCongViec';

    if (params.date_from) {
      const fromDate = params.date_from.includes('T')
        ? params.date_from
        : `${params.date_from} 00:00:00`;
      qb.andWhere(`${dateField} >= :fromDate`, { fromDate });
    }
    if (params.date_to) {
      const toDate = params.date_to.includes('T')
        ? params.date_to
        : `${params.date_to} 23:59:59.999`;
      qb.andWhere(`${dateField} <= :toDate`, { toDate });
    }

    // 3. Lọc theo Chi nhánh
    if (params.branchId) {
      qb.andWhere('case.branchExternalId = :branchId', {
        branchId: params.branchId,
      });
    }

    // 4. Lọc theo Phân loại
    if (params.classification) {
      qb.andWhere('case.classification = :classification', {
        classification: params.classification,
      });
    }

    // 5. Tìm kiếm từ khóa
    if (params.q) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('case.soChungTu ILIKE :q', { q: `%${params.q}%` })
            .orWhere('case.bienSoXe ILIKE :q', { q: `%${params.q}%` })
            .orWhere('case.khachHangName ILIKE :q', { q: `%${params.q}%` })
            .orWhere('case.khachHangCode ILIKE :q', { q: `%${params.q}%` });
        }),
      );
    }

    // Thứ tự sắp xếp: Ngày hoàn thành mới nhất -> Số chứng từ
    qb.orderBy('case.ngayHoanThanhCongViec', 'DESC', 'NULLS LAST')
      .addOrderBy('case.ngayPhatSinh', 'DESC', 'NULLS LAST')
      .addOrderBy('case.soChungTu', 'DESC');

    const cases = await qb.getMany();

    // Tra cứu bản đồ tên Chi nhánh
    let branchNameMap: Record<string, string> = {};
    if (this.branchRepo) {
      const branches = await this.branchRepo.find();
      branchNameMap = branches.reduce(
        (acc, b) => {
          if (b.externalId) {
            acc[b.externalId] = b.name || b.code || b.externalId;
          }
          return acc;
        },
        {} as Record<string, string>,
      );
    }

    // Tra cứu danh sách hóa đơn VAT liên kết
    const caseDbIds = cases.map((c) => c.id).filter(Boolean);
    const linkedInvoiceSummaryMap: Record<string, string> = {};

    if (this.linkedInvoiceRepo && caseDbIds.length > 0) {
      try {
        const linkedRows = await this.linkedInvoiceRepo
          .createQueryBuilder('l')
          .leftJoin('erp_invoices', 'inv', 'inv.id = l.invoiceId')
          .select('l.caseDbId', 'caseDbId')
          .addSelect(
            "STRING_AGG(DISTINCT COALESCE(inv.invoice_no, CAST(l.invoiceId AS text)), ', ')",
            'invoiceNos',
          )
          .where('l.caseDbId IN (:...caseDbIds)', { caseDbIds })
          .groupBy('l.caseDbId')
          .getRawMany();

        for (const r of linkedRows) {
          if (r.caseDbId && r.invoiceNos) {
            linkedInvoiceSummaryMap[r.caseDbId] = r.invoiceNos;
          }
        }
      } catch (err) {
        this.logger.warn(
          `Failed to aggregate linked invoices for export: ${err}`,
        );
      }
    }

    // Tra cứu danh sách dòng dịch vụ / phụ tùng cho Sheet 2 từ nhiều nguồn:
    // (1) Bảng kgara_case_services, (2) case.rawData.ListPhieuDichVuChiTiet, (3) KGara Client getCaseDetail
    const hdIds = cases.map((c) => c.hdPhieuDichVuId).filter(Boolean);
    const serviceLinesMap = new Map<string, any[]>();

    if (this.serviceRepo && hdIds.length > 0) {
      try {
        const dbLines = await this.serviceRepo
          .createQueryBuilder('line')
          .where('line.hdPhieuDichVuId IN (:...hdIds)', { hdIds })
          .orderBy('line.hdPhieuDichVuId', 'ASC')
          .addOrderBy('line.createdAt', 'ASC')
          .getMany();

        for (const line of dbLines) {
          if (line.hdPhieuDichVuId) {
            const list = serviceLinesMap.get(line.hdPhieuDichVuId) || [];
            list.push(line);
            serviceLinesMap.set(line.hdPhieuDichVuId, list);
          }
        }
      } catch (err) {
        this.logger.warn(`Failed to query service lines from DB: ${err}`);
      }
    }

    // Với các case chưa có dòng trong DB, kiểm tra case.rawData
    const casesNeedingFetch: KgaraCase[] = [];
    for (const c of cases) {
      if (!c.hdPhieuDichVuId) continue;
      if (serviceLinesMap.has(c.hdPhieuDichVuId)) continue;

      const rawList =
        c.rawData?.ListPhieuDichVuChiTiet ||
        c.rawData?.HoaDonChiTiet ||
        c.rawData?.PhieuDichVuChiTiet;

      if (Array.isArray(rawList) && rawList.length > 0) {
        serviceLinesMap.set(c.hdPhieuDichVuId, rawList);
      } else if (this.client && c.branchExternalId) {
        casesNeedingFetch.push(c);
      }
    }

    // Nếu vẫn còn case chưa có chi tiết, fetch trực tiếp từ KGara Client theo batch
    if (this.client && casesNeedingFetch.length > 0) {
      const BATCH_SIZE = 5;
      for (let i = 0; i < casesNeedingFetch.length; i += BATCH_SIZE) {
        const batch = casesNeedingFetch.slice(i, i + BATCH_SIZE);
        await Promise.allSettled(
          batch.map(async (c) => {
            try {
              const freshData = await this.client!.getCaseDetail(
                c.hdPhieuDichVuId,
                c.branchExternalId!,
              );
              if (freshData) {
                const payload = freshData.data || freshData;
                const rawList =
                  payload.ListPhieuDichVuChiTiet ||
                  payload.HoaDonChiTiet ||
                  payload.PhieuDichVuChiTiet;
                if (Array.isArray(rawList) && rawList.length > 0) {
                  serviceLinesMap.set(c.hdPhieuDichVuId, rawList);
                  c.rawData = { ...c.rawData, ...payload };
                  this.caseRepo.save(c).catch(() => {});
                }
              }
            } catch (fetchErr) {
              this.logger.debug(
                `Could not fetch detail for case ${c.soChungTu || c.hdPhieuDichVuId}: ${fetchErr}`,
              );
            }
          }),
        );
      }
    }

    // Map nhanh thông tin Case cha cho từng dòng service
    const caseMapByHdId = new Map<string, KgaraCase>();
    for (const c of cases) {
      if (c.hdPhieuDichVuId) {
        caseMapByHdId.set(c.hdPhieuDichVuId, c);
      }
    }

    const CLASSIFICATION_LABELS: Record<string, string> = {
      KY_GUI_NOI_BO: 'Ký gửi nội bộ',
      SUA_CHUA_CHUNG: 'Sửa chữa chung',
      OJ: 'OJ',
      OJ_NGOAI: 'OJ ngoài',
      KHAC: 'Khác',
    };

    const formatDisplayDate = (d?: Date | string | null): string => {
      if (!d) return '—';
      try {
        const dt = typeof d === 'string' ? new Date(d) : d;
        if (isNaN(dt.getTime())) return String(d);
        const day = String(dt.getDate()).padStart(2, '0');
        const month = String(dt.getMonth() + 1).padStart(2, '0');
        const year = dt.getFullYear();
        return `${day}/${month}/${year}`;
      } catch {
        return String(d);
      }
    };

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Liouni ERP';
    workbook.lastModifiedBy = 'Liouni ERP';
    workbook.created = new Date();

    // ─────────────────────────────────────────────────────────────────────────
    // SHEET 1: BẢNG KÊ PHIẾU DỊCH VỤ ĐÃ KẾT THÚC
    // ─────────────────────────────────────────────────────────────────────────
    const sheet1 = workbook.addWorksheet('Bảng kê phiếu kết thúc');
    sheet1.views = [{ state: 'frozen', ySplit: 1 }];
    sheet1.autoFilter = 'A1:R1';

    sheet1.columns = [
      { header: 'STT', key: 'index', width: 8 },
      { header: 'Số phiếu', key: 'soChungTu', width: 18 },
      { header: 'Biển số xe', key: 'bienSoXe', width: 14 },
      { header: 'Mã KH', key: 'khachHangCode', width: 16 },
      { header: 'Tên khách hàng', key: 'khachHangName', width: 30 },
      { header: 'Chi nhánh', key: 'branchName', width: 22 },
      { header: 'Phân loại', key: 'classification', width: 18 },
      { header: 'Ngày tiếp nhận', key: 'ngayTiepNhan', width: 16 },
      { header: 'Ngày hoàn thành', key: 'ngayHoanThanhCongViec', width: 18 },
      {
        header: 'Tổng tiền có thuế (VNĐ)',
        key: 'tienCoThue',
        width: 22,
        style: { numFmt: '#,##0' },
      },
      {
        header: 'Doanh thu (VNĐ)',
        key: 'doanhThu',
        width: 20,
        style: { numFmt: '#,##0' },
      },
      {
        header: 'Chi phí / Giá vốn (VNĐ)',
        key: 'chiPhi',
        width: 22,
        style: { numFmt: '#,##0' },
      },
      {
        header: 'Lợi nhuận gộp (VNĐ)',
        key: 'loiNhuan',
        width: 22,
        style: { numFmt: '#,##0' },
      },
      {
        header: 'Biên LN (%)',
        key: 'margin',
        width: 14,
        style: { numFmt: '0.0"%"' },
      },
      {
        header: 'Đã thu (VNĐ)',
        key: 'tienDaThanhToan',
        width: 20,
        style: { numFmt: '#,##0' },
      },
      {
        header: 'Còn nợ (VNĐ)',
        key: 'tienConPhaiThanhToan',
        width: 20,
        style: { numFmt: '#,##0' },
      },
      { header: 'Hóa đơn VAT liên kết', key: 'linkedInvoices', width: 25 },
      { header: 'Trạng thái', key: 'tenTinhTrangDichVu', width: 18 },
    ];

    // Format Header Sheet 1
    const headerRow1 = sheet1.getRow(1);
    headerRow1.height = 28;
    headerRow1.font = {
      name: 'Arial',
      size: 10,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    headerRow1.alignment = {
      horizontal: 'center',
      vertical: 'middle',
      wrapText: true,
    };
    headerRow1.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF334155' },
    };

    cases.forEach((c: any, idx: number) => {
      const gp = c.grossProfit;
      const rev = Number(c.doanhThu ?? gp?.doanhThu ?? c.tienCoThue) || 0;
      const cost = Number(c.chiPhi ?? gp?.chiPhi) || 0;
      const profit = Number(c.loiNhuan ?? gp?.loiNhuan ?? rev - cost) || 0;
      const margin = rev > 0 ? (profit / rev) * 100 : 0;
      const totalAmount = Number(c.tienCoThue) || rev;
      const paid = Number(c.tienDaThanhToan) || 0;
      const balance =
        Number(c.tienConPhaiThanhToan) || Math.max(0, totalAmount - paid);

      const branchName =
        branchNameMap[c.branchExternalId] || c.branchExternalId || '—';
      const classLabel = c.classification
        ? CLASSIFICATION_LABELS[c.classification] || c.classification
        : 'Sửa chữa chung';

      const row = sheet1.addRow({
        index: idx + 1,
        soChungTu: c.soChungTu || '—',
        bienSoXe: c.bienSoXe || '—',
        khachHangCode: c.khachHangCode || '—',
        khachHangName: c.khachHangName || '—',
        branchName,
        classification: classLabel,
        ngayTiepNhan: formatDisplayDate(c.ngayTiepNhan || c.ngayPhatSinh),
        ngayHoanThanhCongViec: formatDisplayDate(c.ngayHoanThanhCongViec),
        tienCoThue: totalAmount,
        doanhThu: rev,
        chiPhi: cost,
        loiNhuan: profit,
        margin: margin,
        tienDaThanhToan: paid,
        tienConPhaiThanhToan: balance,
        linkedInvoices: linkedInvoiceSummaryMap[c.id] || '—',
        tenTinhTrangDichVu: c.tenTinhTrangDichVu || 'Đã kết thúc',
      });

      row.alignment = { vertical: 'middle' };
      row.getCell('index').alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      row.getCell('soChungTu').alignment = {
        horizontal: 'left',
        vertical: 'middle',
      };
      row.getCell('bienSoXe').alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      row.getCell('ngayTiepNhan').alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      row.getCell('ngayHoanThanhCongViec').alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      row.getCell('tenTinhTrangDichVu').alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
    });

    // Dòng Tổng Cộng Footer Sheet 1
    const totalCasesCount = cases.length;
    if (totalCasesCount > 0) {
      const summaryRowIndex = totalCasesCount + 2;
      const summaryRow = sheet1.getRow(summaryRowIndex);
      summaryRow.height = 24;
      summaryRow.font = { name: 'Arial', size: 10, bold: true };

      summaryRow.getCell(1).value = `TỔNG CỘNG (${totalCasesCount} phiếu)`;
      sheet1.mergeCells(`A${summaryRowIndex}:I${summaryRowIndex}`);
      summaryRow.getCell(1).alignment = {
        horizontal: 'right',
        vertical: 'middle',
      };

      // Công thức SUM
      summaryRow.getCell(10).value = {
        formula: `SUM(J2:J${summaryRowIndex - 1})`,
      };
      summaryRow.getCell(11).value = {
        formula: `SUM(K2:K${summaryRowIndex - 1})`,
      };
      summaryRow.getCell(12).value = {
        formula: `SUM(L2:L${summaryRowIndex - 1})`,
      };
      summaryRow.getCell(13).value = {
        formula: `SUM(M2:M${summaryRowIndex - 1})`,
      };
      summaryRow.getCell(14).value = {
        formula: `IF(K${summaryRowIndex}>0, (M${summaryRowIndex}/K${summaryRowIndex})*100, 0)`,
      };
      summaryRow.getCell(15).value = {
        formula: `SUM(O2:O${summaryRowIndex - 1})`,
      };
      summaryRow.getCell(16).value = {
        formula: `SUM(P2:P${summaryRowIndex - 1})`,
      };

      summaryRow.getCell(10).numFmt = '#,##0';
      summaryRow.getCell(11).numFmt = '#,##0';
      summaryRow.getCell(12).numFmt = '#,##0';
      summaryRow.getCell(13).numFmt = '#,##0';
      summaryRow.getCell(14).numFmt = '0.0"%"';
      summaryRow.getCell(15).numFmt = '#,##0';
      summaryRow.getCell(16).numFmt = '#,##0';

      for (let col = 1; col <= 18; col++) {
        const cell = summaryRow.getCell(col);
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF1F5F9' },
        };
        cell.border = {
          top: { style: 'thin' },
          bottom: { style: 'double' },
        };
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SHEET 2: CHI TIẾT DỊCH VỤ & PHỤ TÙNG
    // ─────────────────────────────────────────────────────────────────────────
    const sheet2 = workbook.addWorksheet('Chi tiết DV & Phụ tùng');
    sheet2.views = [{ state: 'frozen', ySplit: 1 }];
    sheet2.autoFilter = 'A1:T1';

    sheet2.columns = [
      { header: 'STT', key: 'index', width: 8 },
      { header: 'Số phiếu DV', key: 'soChungTu', width: 18 },
      { header: 'Biển số xe', key: 'bienSoXe', width: 14 },
      { header: 'Phân loại', key: 'loaiHienThi', width: 14 },
      { header: 'Mã SKU / Mã DV', key: 'sanPhamCode', width: 18 },
      { header: 'Tên sản phẩm / Công việc', key: 'sanPhamName', width: 34 },
      { header: 'Nội dung chi tiết', key: 'noiDungChiTiet', width: 30 },
      { header: 'ĐVT', key: 'donViTinhText', width: 10 },
      {
        header: 'Số lượng',
        key: 'soLuongHoaDon',
        width: 12,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Đơn giá (VNĐ)',
        key: 'donGia',
        width: 16,
        style: { numFmt: '#,##0' },
      },
      {
        header: 'Thành tiền trước thuế (VNĐ)',
        key: 'tienChuaThue',
        width: 22,
        style: { numFmt: '#,##0' },
      },
      {
        header: 'Thuế suất',
        key: 'thueSuat',
        width: 12,
        style: { numFmt: '0"%"' },
      },
      {
        header: 'Thành tiền có thuế (VNĐ)',
        key: 'tienCoThue',
        width: 22,
        style: { numFmt: '#,##0' },
      },
      {
        header: 'Giờ công',
        key: 'soGioCongLam',
        width: 12,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Tiền công DV (VNĐ)',
        key: 'tienDichVu',
        width: 18,
        style: { numFmt: '#,##0' },
      },
      {
        header: 'Tiền phụ tùng (VNĐ)',
        key: 'tienPhuTung',
        width: 18,
        style: { numFmt: '#,##0' },
      },
      {
        header: 'Giá vốn PT (VNĐ)',
        key: 'giaVonPhuTung',
        width: 18,
        style: { numFmt: '#,##0' },
      },
      {
        header: 'Chiết khấu (VNĐ)',
        key: 'tienChietKhauCt',
        width: 16,
        style: { numFmt: '#,##0' },
      },
      { header: 'Mã kho', key: 'khoCode', width: 14 },
      { header: 'Ghi chú / Phụ phí', key: 'ghiChu', width: 20 },
    ];

    // Format Header Sheet 2
    const headerRow2 = sheet2.getRow(1);
    headerRow2.height = 28;
    headerRow2.font = {
      name: 'Arial',
      size: 10,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    headerRow2.alignment = {
      horizontal: 'center',
      vertical: 'middle',
      wrapText: true,
    };
    headerRow2.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' },
    };

    let lineIdx = 0;
    for (const c of cases) {
      if (!c.hdPhieuDichVuId) continue;
      const lines = serviceLinesMap.get(c.hdPhieuDichVuId) || [];
      for (const line of lines) {
        lineIdx++;
        const loaiSanPhamCode =
          line.loaiSanPhamCode || line.LoaiSanPhamCode || '';
        const tienPhuTung = Number(line.tienPhuTung ?? line.TienPhuTung ?? 0);
        const loaiChiTiet = line.loaiChiTiet ?? line.LoaiChiTiet;
        const nhomInName = (
          line.nhomInName ||
          line.NhomInName ||
          ''
        ).toLowerCase();

        const isPt =
          loaiSanPhamCode === 'PT' ||
          loaiChiTiet === 1 ||
          loaiChiTiet === 4 ||
          nhomInName.includes('phụ tùng') ||
          nhomInName.includes('vật tư') ||
          tienPhuTung > 0;

        const loaiHienThi = isPt ? 'Phụ tùng' : 'Dịch vụ';
        const sanPhamCode = line.sanPhamCode || line.SanPhamCode || '—';
        const sanPhamName =
          line.sanPhamName ||
          line.SanPhamName ||
          line.noiDungChiTiet ||
          line.NoiDungChiTiet ||
          '—';
        const noiDungChiTiet =
          line.noiDungChiTiet || line.NoiDungChiTiet || '—';
        const donViTinhText = line.donViTinhText || line.DonViTinhText || '—';
        const soLuongHoaDon = Number(
          line.soLuongHoaDon ?? line.SoLuongHoaDon ?? 0,
        );
        const donGia = Number(line.donGia ?? line.DonGia ?? 0);
        const tienChuaThue = Number(
          line.tienChuaThue ?? line.TienChuaThue ?? 0,
        );
        const thueSuat =
          Number(line.thueSuat ?? line.ThueSuat ?? 0) > 1
            ? Number(line.thueSuat ?? line.ThueSuat ?? 0) / 100
            : Number(line.thueSuat ?? line.ThueSuat ?? 0);
        const tienCoThue = Number(line.tienCoThue ?? line.TienCoThue ?? 0);
        const soGioCongLam = Number(
          line.soGioCongLam ?? line.SoGioCongLam ?? 0,
        );
        const tienDichVu = Number(line.tienDichVu ?? line.TienDichVu ?? 0);
        const giaVonPhuTung = Number(
          line.giaVonPhuTung ?? line.GiaVonPhuTung ?? 0,
        );
        const tienChietKhauCt = Number(
          line.tienChietKhauCt ??
            line.TienChietKhauCT ??
            line.TienChietKhauCt ??
            0,
        );
        const khoCode = line.khoCode || line.KhoCode || line.KhoName || '—';
        const ghiChu =
          line.ghiChu ||
          line.GhiChuChiTiet ||
          (line.TienPhuPhi || line.tienPhuPhi
            ? `Phụ phí: ${line.TienPhuPhi || line.tienPhuPhi}`
            : '—');

        const row = sheet2.addRow({
          index: lineIdx,
          soChungTu: c.soChungTu || '—',
          bienSoXe: c.bienSoXe || '—',
          loaiHienThi,
          sanPhamCode,
          sanPhamName,
          noiDungChiTiet,
          donViTinhText,
          soLuongHoaDon,
          donGia,
          tienChuaThue,
          thueSuat,
          tienCoThue,
          soGioCongLam,
          tienDichVu,
          tienPhuTung,
          giaVonPhuTung,
          tienChietKhauCt,
          khoCode,
          ghiChu,
        });

        row.alignment = { vertical: 'middle' };
        row.getCell('index').alignment = {
          horizontal: 'center',
          vertical: 'middle',
        };
        row.getCell('soChungTu').alignment = {
          horizontal: 'left',
          vertical: 'middle',
        };
        row.getCell('bienSoXe').alignment = {
          horizontal: 'center',
          vertical: 'middle',
        };
        row.getCell('loaiHienThi').alignment = {
          horizontal: 'center',
          vertical: 'middle',
        };
        row.getCell('donViTinhText').alignment = {
          horizontal: 'center',
          vertical: 'middle',
        };
        row.getCell('khoCode').alignment = {
          horizontal: 'center',
          vertical: 'middle',
        };
      }
    }

    // Dòng Tổng Cộng Footer Sheet 2
    const totalLinesCount = lineIdx;
    if (totalLinesCount > 0) {
      const summaryRowIndex2 = totalLinesCount + 2;
      const summaryRow2 = sheet2.getRow(summaryRowIndex2);
      summaryRow2.height = 24;
      summaryRow2.font = { name: 'Arial', size: 10, bold: true };

      summaryRow2.getCell(1).value = `TỔNG CỘNG (${totalLinesCount} dòng)`;
      sheet2.mergeCells(`A${summaryRowIndex2}:H${summaryRowIndex2}`);
      summaryRow2.getCell(1).alignment = {
        horizontal: 'right',
        vertical: 'middle',
      };

      // Công thức SUM Sheet 2
      summaryRow2.getCell(9).value = {
        formula: `SUM(I2:I${summaryRowIndex2 - 1})`,
      };
      summaryRow2.getCell(11).value = {
        formula: `SUM(K2:K${summaryRowIndex2 - 1})`,
      };
      summaryRow2.getCell(13).value = {
        formula: `SUM(M2:M${summaryRowIndex2 - 1})`,
      };
      summaryRow2.getCell(14).value = {
        formula: `SUM(N2:N${summaryRowIndex2 - 1})`,
      };
      summaryRow2.getCell(15).value = {
        formula: `SUM(O2:O${summaryRowIndex2 - 1})`,
      };
      summaryRow2.getCell(16).value = {
        formula: `SUM(P2:P${summaryRowIndex2 - 1})`,
      };
      summaryRow2.getCell(17).value = {
        formula: `SUM(Q2:Q${summaryRowIndex2 - 1})`,
      };
      summaryRow2.getCell(18).value = {
        formula: `SUM(R2:R${summaryRowIndex2 - 1})`,
      };

      summaryRow2.getCell(9).numFmt = '#,##0.00';
      summaryRow2.getCell(11).numFmt = '#,##0';
      summaryRow2.getCell(13).numFmt = '#,##0';
      summaryRow2.getCell(14).numFmt = '#,##0.00';
      summaryRow2.getCell(15).numFmt = '#,##0';
      summaryRow2.getCell(16).numFmt = '#,##0';
      summaryRow2.getCell(17).numFmt = '#,##0';
      summaryRow2.getCell(18).numFmt = '#,##0';

      for (let col = 1; col <= 20; col++) {
        const cell = summaryRow2.getCell(col);
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF1F5F9' },
        };
        cell.border = {
          top: { style: 'thin' },
          bottom: { style: 'double' },
        };
      }
    }

    const uint8Array = await workbook.xlsx.writeBuffer();
    return Buffer.from(uint8Array);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CASE SERVICES (CHI TIẾT DÒNG DỊCH VỤ & PHỤ TÙNG) QUERY ENGINE
  // ──────────────────────────────────────────────────────────────────────────

  getCaseServiceColumnSelectExpr(column: string): string | null {
    const mapping: Record<string, string> = {
      sanPhamCode: '"srv"."san_pham_code"',
      sanPhamName: '"srv"."san_pham_name"',
      noiDungChiTiet: '"srv"."noi_dung_chi_tiet"',
      loaiSanPhamCode: '"srv"."loai_san_pham_code"',
      donViTinhText: '"srv"."don_vi_tinh_text"',
      khoCode: '"srv"."kho_code"',
      soLuongHoaDon: '"srv"."so_luong_hoa_don"',
      donGia: '"srv"."don_gia"',
      tienChuaThue: '"srv"."tien_chua_thue"',
      thueSuat: '"srv"."thue_suat"',
      tienCoThue: '"srv"."tien_co_thue"',
      soGioCongLam: '"srv"."so_gio_cong_lam"',
      tienDichVu: '"srv"."tien_dich_vu"',
      tienPhuTung: '"srv"."tien_phu_tung"',
      giaVonPhuTung: '"srv"."gia_von_phu_tung"',
      tyLeChietKhauCt: '"srv"."ty_le_chiet_khau_ct"',
      tienChietKhauCt: '"srv"."tien_chiet_khau_ct"',
      tienPhuPhi: '"srv"."tien_phu_phi"',
      caseCode: '"c"."so_chung_tu"',
      soChungTu: '"c"."so_chung_tu"',
      licensePlate: '"c"."bien_so_xe"',
      bienSoXe: '"c"."bien_so_xe"',
      customer:
        'CONCAT(COALESCE("c"."khach_hang_name", \'\'), \' \', COALESCE("c"."khach_hang_code", \'\'))',
      customerCode: '"c"."khach_hang_code"',
      khachHangCode: '"c"."khach_hang_code"',
      customerName: '"c"."khach_hang_name"',
      khachHangName: '"c"."khach_hang_name"',
      statusName: '"c"."ten_tinh_trang_dich_vu"',
      status: '"c"."tinh_trang_dich_vu"',
      classification: '"c"."classification"',
      branchName: '"c"."branch_external_id"',
      branchExternalId: '"c"."branch_external_id"',
      caseDate:
        'TO_CHAR(COALESCE("c"."ngay_tiep_nhan", "c"."ngay_phat_sinh"), \'YYYY-MM-DD\')',
      ngayPhatSinh: 'TO_CHAR("c"."ngay_phat_sinh", \'YYYY-MM-DD\')',
      ngayTiepNhan:
        'TO_CHAR(COALESCE("c"."ngay_tiep_nhan", "c"."ngay_phat_sinh"), \'YYYY-MM-DD\')',
      ngayHoanThanhCongViec:
        'TO_CHAR("c"."ngay_hoan_thanh_cong_viec", \'YYYY-MM-DD\')',
      completionDate:
        'TO_CHAR("c"."ngay_hoan_thanh_cong_viec", \'YYYY-MM-DD\')',
      hasLinkedInvoice:
        'CASE WHEN EXISTS (SELECT 1 FROM kgara_case_linked_invoice l WHERE l."caseDbId" = "c".id) THEN \'YES\' ELSE \'NO\' END',
    };

    return mapping[column] || null;
  }

  applySingleCaseServiceColumnFilter(
    qb: SelectQueryBuilder<KgaraCaseService>,
    column: string,
    values: string[],
    paramPrefix: string,
  ) {
    if (!values || values.length === 0) return;

    // 0. Xử lý khoảng ngày (Date Range: "YYYY-MM-DD..YYYY-MM-DD" hoặc "YYYY-MM-DD|YYYY-MM-DD")
    if (
      values.length === 1 &&
      (values[0].includes('..') || values[0].includes('|'))
    ) {
      const separator = values[0].includes('..') ? '..' : '|';
      const [fromDate, toDate] = values[0].split(separator);
      const filterExpr = this.getCaseServiceColumnSelectExpr(column);
      if (filterExpr) {
        if (fromDate) {
          qb.andWhere(`${filterExpr} >= :${paramPrefix}_from_date`, {
            [`${paramPrefix}_from_date`]: fromDate,
          });
        }
        if (toDate) {
          qb.andWhere(`${filterExpr} <= :${paramPrefix}_to_date`, {
            [`${paramPrefix}_to_date`]: toDate,
          });
        }
        return;
      }
    }

    // 1. Xử lý __ALL_MATCHING__ (Chọn tất cả kết quả tìm kiếm)
    if (values[0] === '__ALL_MATCHING__') {
      const searchStr = (values[1] || '').trim();
      if (!searchStr) return;
      const filterExpr = this.getCaseServiceColumnSelectExpr(column);
      if (filterExpr) {
        applyMultiKeywordFilter(
          qb,
          `CAST(${filterExpr} AS TEXT)`,
          searchStr,
          `${paramPrefix}_search`,
        );
      }
      return;
    }

    // 2. Cột đặc thù: serviceType / loaiSanPhamCode (DV, PT)
    if (column === 'serviceType' || column === 'loaiSanPhamCode') {
      const filtered = values.filter((v) => v !== 'ALL');
      if (filtered.length > 0) {
        qb.andWhere(
          `"srv"."loai_san_pham_code" IN (:...${paramPrefix}_types)`,
          {
            [`${paramPrefix}_types`]: filtered,
          },
        );
      }
      return;
    }

    // 3. Cột số tiền & số lượng
    const numericColumns = [
      'soLuongHoaDon',
      'donGia',
      'tienChuaThue',
      'thueSuat',
      'tienCoThue',
      'soGioCongLam',
      'tienDichVu',
      'tienPhuTung',
      'giaVonPhuTung',
      'tyLeChietKhauCt',
      'tienChietKhauCt',
      'tienPhuPhi',
    ];
    if (numericColumns.includes(column)) {
      const filterExpr = this.getCaseServiceColumnSelectExpr(column);
      if (!filterExpr) return;

      const hasBlank = values.includes('__BLANK__');
      const realVals = values.filter((v) => v !== '__BLANK__');
      const numericVals = realVals
        .map((v) => Number(v))
        .filter((v) => !isNaN(v));

      const conditions: string[] = [];
      if (hasBlank) {
        conditions.push(`(${filterExpr} IS NULL OR ${filterExpr} = 0)`);
      }
      if (numericVals.length > 0) {
        conditions.push(`${filterExpr} IN (:...${paramPrefix}_num_vals)`);
      }

      if (conditions.length > 0) {
        qb.andWhere(`(${conditions.join(' OR ')})`, {
          [`${paramPrefix}_num_vals`]: numericVals,
        });
      }
      return;
    }

    // 4. Cột phân loại / text thông thường
    const filterExpr = this.getCaseServiceColumnSelectExpr(column);
    if (!filterExpr) return;

    const hasBlank = values.includes('__BLANK__');
    const realVals = values.filter((v) => v !== '__BLANK__');

    if (hasBlank && realVals.length > 0) {
      qb.andWhere(
        `(${filterExpr} IS NULL OR CAST(${filterExpr} AS TEXT) = '' OR CAST(${filterExpr} AS TEXT) IN (:...${paramPrefix}_vals))`,
        { [`${paramPrefix}_vals`]: realVals },
      );
    } else if (hasBlank) {
      qb.andWhere(
        `(${filterExpr} IS NULL OR CAST(${filterExpr} AS TEXT) = '')`,
      );
    } else {
      qb.andWhere(`CAST(${filterExpr} AS TEXT) IN (:...${paramPrefix}_vals)`, {
        [`${paramPrefix}_vals`]: realVals,
      });
    }
  }

  applyCaseServiceFilters(
    qb: SelectQueryBuilder<KgaraCaseService>,
    filtersStr?: string,
    prefix: string = 'list_',
  ) {
    if (!filtersStr) return;

    try {
      const filters = JSON.parse(filtersStr) as Record<string, string[]>;
      for (const [column, values] of Object.entries(filters)) {
        if (!values || values.length === 0) continue;
        this.applySingleCaseServiceColumnFilter(
          qb,
          column,
          values,
          `${prefix}${column}`,
        );
      }
    } catch {
      // ignore malformed filter payloads
    }
  }

  async findCaseServices(params: {
    branchId?: string;
    page?: number | string;
    pageSize?: number | string;
    q?: string;
    from?: string;
    to?: string;
    serviceType?: string;
    filtersStr?: string;
    sorts?: string | string[];
  }) {
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(params.pageSize) || 20));
    const offset = (page - 1) * pageSize;

    this.logger.log(
      `findCaseServices called: branchId=${params.branchId}, page=${page}, pageSize=${pageSize}, q=${params.q}, serviceType=${params.serviceType}, filtersStr=${params.filtersStr}`,
    );

    const repo =
      this.serviceRepo || this.caseRepo.manager.getRepository(KgaraCaseService);

    const baseQb = repo
      .createQueryBuilder('srv')
      .innerJoin(
        KgaraCase,
        'c',
        'c.hd_phieu_dich_vu_id = srv.hd_phieu_dich_vu_id',
      )
      .leftJoin(KgaraBranch, 'b', 'b.external_id = c.branch_external_id')
      .where('c.kgara_deleted_at IS NULL');

    if (
      params.branchId &&
      params.branchId !== 'null' &&
      params.branchId !== 'undefined' &&
      params.branchId.trim() !== ''
    ) {
      baseQb.andWhere('c.branch_external_id = :branchId', {
        branchId: params.branchId.trim(),
      });
    }

    if (params.serviceType && params.serviceType !== 'ALL') {
      baseQb.andWhere('srv.loai_san_pham_code = :serviceType', {
        serviceType: params.serviceType,
      });
    }

    if (params.from) {
      const fromDate = params.from.includes('T')
        ? params.from
        : `${params.from} 00:00:00`;
      baseQb.andWhere(
        'COALESCE(c.ngay_tiep_nhan, c.ngay_phat_sinh) >= :fromDate',
        { fromDate },
      );
    }

    if (params.to) {
      const toDate = params.to.includes('T')
        ? params.to
        : `${params.to} 23:59:59.999`;
      baseQb.andWhere(
        'COALESCE(c.ngay_tiep_nhan, c.ngay_phat_sinh) <= :toDate',
        { toDate },
      );
    }

    if (params.q) {
      const query = params.q.trim();
      baseQb.andWhere(
        new Brackets((sub) => {
          sub
            .where('srv.san_pham_code ILIKE :q', { q: `%${query}%` })
            .orWhere('srv.san_pham_name ILIKE :q', { q: `%${query}%` })
            .orWhere('srv.noi_dung_chi_tiet ILIKE :q', { q: `%${query}%` })
            .orWhere('c.so_chung_tu ILIKE :q', { q: `%${query}%` })
            .orWhere('c.bien_so_xe ILIKE :q', { q: `%${query}%` })
            .orWhere('c.khach_hang_name ILIKE :q', { q: `%${query}%` })
            .orWhere('c.khach_hang_code ILIKE :q', { q: `%${query}%` });
        }),
      );
    }

    this.applyCaseServiceFilters(baseQb, params.filtersStr, 'list_');

    // Tính tổng Grand Totals và Total count trước khi áp dụng ORDER BY / LIMIT / OFFSET
    const totalsQb = baseQb.clone();
    totalsQb.orderBy(); // Đảm bảo không có ORDER BY trong câu truy vấn tổng hợp
    totalsQb.select([
      'COUNT(srv.id) AS "totalRows"',
      'COALESCE(SUM(srv.so_luong_hoa_don), 0) AS "soLuongHoaDon"',
      'COALESCE(SUM(srv.tien_chua_thue), 0) AS "tienChuaThue"',
      'COALESCE(SUM(srv.tien_co_thue), 0) AS "tienCoThue"',
      'COALESCE(SUM(srv.tien_dich_vu), 0) AS "tienDichVu"',
      'COALESCE(SUM(srv.tien_phu_tung), 0) AS "tienPhuTung"',
      'COALESCE(SUM(srv.gia_von_phu_tung), 0) AS "giaVonPhuTung"',
      'COALESCE(SUM(srv.tien_chiet_khau_ct), 0) AS "tienChietKhauCt"',
      'COALESCE(SUM(srv.tien_phu_phi), 0) AS "tienPhuPhi"',
    ]);

    const rawTotals = await totalsQb.getRawOne();
    const total = Number(rawTotals?.totalRows || 0);

    const grandTotal = {
      soLuongHoaDon: Number(rawTotals?.soLuongHoaDon || 0),
      tienChuaThue: Number(rawTotals?.tienChuaThue || 0),
      tienCoThue: Number(rawTotals?.tienCoThue || 0),
      tienDichVu: Number(rawTotals?.tienDichVu || 0),
      tienPhuTung: Number(rawTotals?.tienPhuTung || 0),
      giaVonPhuTung: Number(rawTotals?.giaVonPhuTung || 0),
      tienChietKhauCt: Number(rawTotals?.tienChietKhauCt || 0),
      tienPhuPhi: Number(rawTotals?.tienPhuPhi || 0),
    };

    // Sắp xếp cho truy vấn danh sách phân trang
    const sortsArr = Array.isArray(params.sorts)
      ? params.sorts
      : params.sorts
        ? [params.sorts]
        : [];

    if (sortsArr.length > 0) {
      let isFirstSort = true;
      for (const s of sortsArr) {
        if (!s) continue;
        const isDesc = s.startsWith('-');
        const rawCol = isDesc ? s.substring(1) : s;
        const colExpr = this.getCaseServiceColumnSelectExpr(rawCol);
        if (colExpr) {
          const orderDir = isDesc ? 'DESC' : 'ASC';
          if (isFirstSort) {
            baseQb.orderBy(colExpr, orderDir);
            isFirstSort = false;
          } else {
            baseQb.addOrderBy(colExpr, orderDir);
          }
        }
      }
    } else {
      baseQb
        .orderBy('c.ngay_tiep_nhan', 'DESC', 'NULLS LAST')
        .addOrderBy('c.ngay_phat_sinh', 'DESC', 'NULLS LAST')
        .addOrderBy('c.so_chung_tu', 'DESC')
        .addOrderBy('srv.created_at', 'ASC');
    }

    // Query các bản ghi cho trang hiện tại
    baseQb
      .select([
        'srv.id AS "id"',
        'srv.hd_phieu_dich_vu_chi_tiet_id AS "hdPhieuDichVuChiTietId"',
        'srv.hd_phieu_dich_vu_id AS "hdPhieuDichVuId"',
        'srv.noi_dung_chi_tiet AS "noiDungChiTiet"',
        'srv.san_pham_code AS "sanPhamCode"',
        'srv.san_pham_name AS "sanPhamName"',
        'srv.loai_san_pham_code AS "loaiSanPhamCode"',
        'srv.don_vi_tinh_text AS "donViTinhText"',
        'srv.so_luong_hoa_don AS "soLuongHoaDon"',
        'srv.don_gia AS "donGia"',
        'srv.tien_chua_thue AS "tienChuaThue"',
        'srv.thue_suat AS "thueSuat"',
        'srv.tien_co_thue AS "tienCoThue"',
        'srv.so_gio_cong_lam AS "soGioCongLam"',
        'srv.tien_dich_vu AS "tienDichVu"',
        'srv.tien_phu_tung AS "tienPhuTung"',
        'srv.gia_von_phu_tung AS "giaVonPhuTung"',
        'srv.ty_le_chiet_khau_ct AS "tyLeChietKhauCt"',
        'srv.tien_chiet_khau_ct AS "tienChietKhauCt"',
        'srv.kho_code AS "khoCode"',
        'srv.tien_phu_phi AS "tienPhuPhi"',
        'c.so_chung_tu AS "soChungTu"',
        'c.bien_so_xe AS "bienSoXe"',
        'c.khach_hang_code AS "khachHangCode"',
        'c.khach_hang_name AS "khachHangName"',
        'c.tinh_trang_dich_vu AS "status"',
        'c.ten_tinh_trang_dich_vu AS "statusName"',
        'c.classification AS "classification"',
        'c.branch_external_id AS "branchExternalId"',
        'COALESCE(b.name, b.code, c.branch_external_id) AS "branchName"',
        'TO_CHAR(COALESCE(c.ngay_tiep_nhan, c.ngay_phat_sinh), \'YYYY-MM-DD\') AS "caseDate"',
        'TO_CHAR(c.ngay_hoan_thanh_cong_viec, \'YYYY-MM-DD\') AS "completionDate"',
      ])
      .offset(offset)
      .limit(pageSize);

    const rawRows = await baseQb.getRawMany();

    const data = rawRows.map((r) => ({
      id: r.id,
      hdPhieuDichVuChiTietId: r.hdPhieuDichVuChiTietId,
      hdPhieuDichVuId: r.hdPhieuDichVuId,
      soChungTu: r.soChungTu,
      bienSoXe: r.bienSoXe,
      khachHangCode: r.khachHangCode,
      khachHangName: r.khachHangName,
      caseDate: r.caseDate,
      completionDate: r.completionDate,
      branchExternalId: r.branchExternalId,
      branchName: r.branchName,
      status: Number(r.status ?? 0),
      statusName: r.statusName,
      classification: r.classification,
      sanPhamCode: r.sanPhamCode,
      sanPhamName: r.sanPhamName,
      noiDungChiTiet: r.noiDungChiTiet,
      loaiSanPhamCode: r.loaiSanPhamCode,
      donViTinhText: r.donViTinhText,
      soLuongHoaDon: Number(r.soLuongHoaDon ?? 0),
      donGia: Number(r.donGia ?? 0),
      tienChuaThue: Number(r.tienChuaThue ?? 0),
      thueSuat: Number(r.thueSuat ?? 0),
      tienCoThue: Number(r.tienCoThue ?? 0),
      soGioCongLam: Number(r.soGioCongLam ?? 0),
      tienDichVu: Number(r.tienDichVu ?? 0),
      tienPhuTung: Number(r.tienPhuTung ?? 0),
      giaVonPhuTung: Number(r.giaVonPhuTung ?? 0),
      tyLeChietKhauCt: Number(r.tyLeChietKhauCt ?? 0),
      tienChietKhauCt: Number(r.tienChietKhauCt ?? 0),
      khoCode: r.khoCode,
      tienPhuPhi: Number(r.tienPhuPhi ?? 0),
    }));

    // Tính tổng lũy kế đến hết trang hiện tại
    let cumulative = { ...grandTotal };
    if (page === 1) {
      cumulative = {
        soLuongHoaDon: data.reduce(
          (acc, r) => acc + (Number(r.soLuongHoaDon) || 0),
          0,
        ),
        tienChuaThue: data.reduce(
          (acc, r) => acc + (Number(r.tienChuaThue) || 0),
          0,
        ),
        tienCoThue: data.reduce(
          (acc, r) => acc + (Number(r.tienCoThue) || 0),
          0,
        ),
        tienDichVu: data.reduce(
          (acc, r) => acc + (Number(r.tienDichVu) || 0),
          0,
        ),
        tienPhuTung: data.reduce(
          (acc, r) => acc + (Number(r.tienPhuTung) || 0),
          0,
        ),
        giaVonPhuTung: data.reduce(
          (acc, r) => acc + (Number(r.giaVonPhuTung) || 0),
          0,
        ),
        tienChietKhauCt: data.reduce(
          (acc, r) => acc + (Number(r.tienChietKhauCt) || 0),
          0,
        ),
        tienPhuPhi: data.reduce(
          (acc, r) => acc + (Number(r.tienPhuPhi) || 0),
          0,
        ),
      };
    } else if (page * pageSize < total) {
      try {
        const cumRows = await baseQb
          .clone()
          .select([
            'srv.so_luong_hoa_don AS "soLuongHoaDon"',
            'srv.tien_chua_thue AS "tienChuaThue"',
            'srv.tien_co_thue AS "tienCoThue"',
            'srv.tien_dich_vu AS "tienDichVu"',
            'srv.tien_phu_tung AS "tienPhuTung"',
            'srv.gia_von_phu_tung AS "giaVonPhuTung"',
            'srv.tien_chiet_khau_ct AS "tienChietKhauCt"',
            'srv.tien_phu_phi AS "tienPhuPhi"',
          ])
          .offset(0)
          .limit(page * pageSize)
          .getRawMany();

        cumulative = {
          soLuongHoaDon: cumRows.reduce(
            (acc, r) => acc + (Number(r.soLuongHoaDon) || 0),
            0,
          ),
          tienChuaThue: cumRows.reduce(
            (acc, r) => acc + (Number(r.tienChuaThue) || 0),
            0,
          ),
          tienCoThue: cumRows.reduce(
            (acc, r) => acc + (Number(r.tienCoThue) || 0),
            0,
          ),
          tienDichVu: cumRows.reduce(
            (acc, r) => acc + (Number(r.tienDichVu) || 0),
            0,
          ),
          tienPhuTung: cumRows.reduce(
            (acc, r) => acc + (Number(r.tienPhuTung) || 0),
            0,
          ),
          giaVonPhuTung: cumRows.reduce(
            (acc, r) => acc + (Number(r.giaVonPhuTung) || 0),
            0,
          ),
          tienChietKhauCt: cumRows.reduce(
            (acc, r) => acc + (Number(r.tienChietKhauCt) || 0),
            0,
          ),
          tienPhuPhi: cumRows.reduce(
            (acc, r) => acc + (Number(r.tienPhuPhi) || 0),
            0,
          ),
        };
      } catch (err) {
        this.logger.warn(
          `Failed to calculate cumulative for case services: ${err}`,
        );
      }
    }

    return {
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
      totals: {
        grandTotal,
        cumulative,
      },
    };
  }

  async getCaseServiceColumnOptions(
    branchId: string,
    column: string,
    search: string = '',
    page: number = 1,
    pageSize: number = 20,
    filtersStr?: string,
    serviceType?: string,
  ): Promise<{
    items: string[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const colExpr = this.getCaseServiceColumnSelectExpr(column);
    if (!colExpr) {
      return { items: [], total: 0, page: 1, totalPages: 1 };
    }

    const repo =
      this.serviceRepo || this.caseRepo.manager.getRepository(KgaraCaseService);

    const qb = repo
      .createQueryBuilder('srv')
      .innerJoin(
        KgaraCase,
        'c',
        'c.hd_phieu_dich_vu_id = srv.hd_phieu_dich_vu_id',
      )
      .where('c.kgara_deleted_at IS NULL');

    if (
      branchId &&
      branchId !== 'null' &&
      branchId !== 'undefined' &&
      branchId.trim() !== ''
    ) {
      qb.andWhere('c.branch_external_id = :branchId', {
        branchId: branchId.trim(),
      });
    }

    if (serviceType && serviceType !== 'ALL') {
      qb.andWhere('srv.loai_san_pham_code = :serviceType', { serviceType });
    }

    if (filtersStr) {
      try {
        const filters = JSON.parse(filtersStr) as Record<string, string[]>;
        for (const [col, values] of Object.entries(filters)) {
          if (col === column) continue;
          if (!values || values.length === 0) continue;
          this.applySingleCaseServiceColumnFilter(
            qb,
            col,
            values,
            `opt_${col}`,
          );
        }
      } catch {
        // ignore malformed filter JSON
      }
    }

    if (search && search.trim()) {
      applyMultiKeywordFilter(
        qb,
        `CAST(${colExpr} AS TEXT)`,
        search.trim(),
        'col_opt_search',
      );
    }

    qb.select(`DISTINCT CAST(${colExpr} AS TEXT)`, 'val').andWhere(
      `${colExpr} IS NOT NULL AND CAST(${colExpr} AS TEXT) != ''`,
    );

    const countQb = qb.clone();
    countQb.orderBy();
    const countRes = await countQb.getRawMany();
    const total = countRes.length;

    qb.orderBy('val', 'ASC')
      .offset((page - 1) * pageSize)
      .limit(pageSize);

    const rows = await qb.getRawMany();
    const items = rows.map((r) => r.val).filter(Boolean);

    return {
      items,
      total,
      page,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  async exportCaseServicesExcel(params: {
    branchId?: string;
    q?: string;
    from?: string;
    to?: string;
    serviceType?: string;
    filtersStr?: string;
    sorts?: string | string[];
  }): Promise<Buffer> {
    const result = await this.findCaseServices({
      ...params,
      page: 1,
      pageSize: 50000,
    });

    const items = result.data || [];

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Liouni ERP';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Chi tiết DV & Phụ tùng', {
      views: [{ state: 'frozen', ySplit: 1, xSplit: 4 }],
    });

    sheet.columns = [
      { header: 'STT', key: 'index', width: 6 },
      { header: 'Ngày tiếp nhận', key: 'caseDate', width: 15 },
      { header: 'Ngày kết thúc', key: 'completionDate', width: 15 },
      { header: 'Số phiếu DV', key: 'soChungTu', width: 22 },
      { header: 'Biển số xe', key: 'bienSoXe', width: 14 },
      { header: 'Khách hàng', key: 'khachHangName', width: 28 },
      { header: 'Loại', key: 'loaiHienThi', width: 14 },
      { header: 'Mã hạng mục', key: 'sanPhamCode', width: 18 },
      { header: 'Tên hạng mục', key: 'sanPhamName', width: 30 },
      { header: 'Diễn giải chi tiết', key: 'noiDungChiTiet', width: 35 },
      { header: 'ĐVT', key: 'donViTinhText', width: 10 },
      { header: 'Số lượng', key: 'soLuongHoaDon', width: 12 },
      { header: 'Đơn giá', key: 'donGia', width: 15 },
      { header: 'Tiền trước thuế', key: 'tienChuaThue', width: 16 },
      { header: 'Thuế suất (%)', key: 'thueSuat', width: 14 },
      { header: 'Thành tiền', key: 'tienCoThue', width: 18 },
      { header: 'Tiền công DV', key: 'tienDichVu', width: 16 },
      { header: 'Tiền phụ tùng', key: 'tienPhuTung', width: 16 },
      { header: 'Giá vốn PT', key: 'giaVonPhuTung', width: 16 },
      { header: 'Chiết khấu', key: 'tienChietKhauCt', width: 14 },
      { header: 'Mã kho', key: 'khoCode', width: 14 },
      { header: 'Chi nhánh', key: 'branchName', width: 22 },
      { header: 'Trạng thái', key: 'statusName', width: 16 },
      { header: 'Phân loại', key: 'classification', width: 18 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.height = 28;
    headerRow.font = {
      name: 'Arial',
      size: 10,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' },
    };
    headerRow.alignment = {
      horizontal: 'center',
      vertical: 'middle',
      wrapText: true,
    };

    items.forEach((item, idx) => {
      const loaiHienThi =
        item.loaiSanPhamCode === 'PT'
          ? 'Phụ tùng'
          : item.loaiSanPhamCode === 'DV'
            ? 'Công dịch vụ'
            : item.loaiSanPhamCode || '—';

      const row = sheet.addRow({
        index: idx + 1,
        caseDate: item.caseDate || '—',
        completionDate: item.completionDate || '—',
        soChungTu: item.soChungTu || '—',
        bienSoXe: item.bienSoXe || '—',
        khachHangName: item.khachHangName || '—',
        loaiHienThi,
        sanPhamCode: item.sanPhamCode || '—',
        sanPhamName: item.sanPhamName || '—',
        noiDungChiTiet: item.noiDungChiTiet || item.sanPhamName || '—',
        donViTinhText: item.donViTinhText || '—',
        soLuongHoaDon: item.soLuongHoaDon || 0,
        donGia: item.donGia || 0,
        tienChuaThue: item.tienChuaThue || 0,
        thueSuat: item.thueSuat || 0,
        tienCoThue: item.tienCoThue || 0,
        tienDichVu: item.tienDichVu || 0,
        tienPhuTung: item.tienPhuTung || 0,
        giaVonPhuTung: item.giaVonPhuTung || 0,
        tienChietKhauCt: item.tienChietKhauCt || 0,
        khoCode: item.khoCode || '—',
        branchName: item.branchName || '—',
        statusName: item.statusName || '—',
        classification: item.classification || '—',
      });

      row.height = 20;
      row.font = { name: 'Arial', size: 9 };
      row.alignment = { vertical: 'middle' };

      row.getCell('index').alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      row.getCell('caseDate').alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      row.getCell('completionDate').alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      row.getCell('bienSoXe').alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      row.getCell('loaiHienThi').alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      row.getCell('donViTinhText').alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      row.getCell('thueSuat').alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      row.getCell('khoCode').alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      row.getCell('statusName').alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      row.getCell('classification').alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };

      row.getCell('soLuongHoaDon').numFmt = '#,##0.00';
      row.getCell('donGia').numFmt = '#,##0';
      row.getCell('tienChuaThue').numFmt = '#,##0';
      row.getCell('tienCoThue').numFmt = '#,##0';
      row.getCell('tienDichVu').numFmt = '#,##0';
      row.getCell('tienPhuTung').numFmt = '#,##0';
      row.getCell('giaVonPhuTung').numFmt = '#,##0';
      row.getCell('tienChietKhauCt').numFmt = '#,##0';

      for (let c = 1; c <= 24; c++) {
        row.getCell(c).border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
      }
    });

    // Summary footer row
    if (items.length > 0) {
      const summaryRowIdx = items.length + 2;
      const summaryRow = sheet.getRow(summaryRowIdx);
      summaryRow.height = 24;
      summaryRow.font = { name: 'Arial', size: 10, bold: true };

      summaryRow.getCell(1).value = `TỔNG CỘNG (${items.length} dòng)`;
      sheet.mergeCells(`A${summaryRowIdx}:K${summaryRowIdx}`);
      summaryRow.getCell(1).alignment = {
        horizontal: 'right',
        vertical: 'middle',
      };

      summaryRow.getCell(12).value = {
        formula: `SUM(L2:L${summaryRowIdx - 1})`,
      };
      summaryRow.getCell(14).value = {
        formula: `SUM(N2:N${summaryRowIdx - 1})`,
      };
      summaryRow.getCell(16).value = {
        formula: `SUM(P2:P${summaryRowIdx - 1})`,
      };
      summaryRow.getCell(17).value = {
        formula: `SUM(Q2:Q${summaryRowIdx - 1})`,
      };
      summaryRow.getCell(18).value = {
        formula: `SUM(R2:R${summaryRowIdx - 1})`,
      };
      summaryRow.getCell(19).value = {
        formula: `SUM(S2:S${summaryRowIdx - 1})`,
      };
      summaryRow.getCell(20).value = {
        formula: `SUM(T2:T${summaryRowIdx - 1})`,
      };

      summaryRow.getCell(12).numFmt = '#,##0.00';
      summaryRow.getCell(14).numFmt = '#,##0';
      summaryRow.getCell(16).numFmt = '#,##0';
      summaryRow.getCell(17).numFmt = '#,##0';
      summaryRow.getCell(18).numFmt = '#,##0';
      summaryRow.getCell(19).numFmt = '#,##0';
      summaryRow.getCell(20).numFmt = '#,##0';

      for (let col = 1; col <= 24; col++) {
        const cell = summaryRow.getCell(col);
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF1F5F9' },
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF94A3B8' } },
          bottom: { style: 'double', color: { argb: 'FF94A3B8' } },
        };
      }
    }

    const uint8Array = await workbook.xlsx.writeBuffer();
    return Buffer.from(uint8Array);
  }
}
