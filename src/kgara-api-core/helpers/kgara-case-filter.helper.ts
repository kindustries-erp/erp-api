import { SelectQueryBuilder } from 'typeorm';
import { KgaraCase } from '../entities/kgara_case.entity';
import { KgaraCaseService } from '../entities/kgara_case_service.entity';
import { applyMultiKeywordFilter } from '../../common/utils/query-builder.util';

/**
 * Ánh xạ tên cột sang biểu thức SQL cho truy vấn Vụ việc (KgaraCase)
 */
export function getCaseColumnSelectExpr(column: string): string | null {
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

/**
 * Áp dụng bộ lọc cho 1 cột trên QueryBuilder của KgaraCase
 */
export function applySingleCaseColumnFilter(
  qb: SelectQueryBuilder<KgaraCase>,
  column: string,
  values: string[],
  paramPrefix: string,
): void {
  if (!values || values.length === 0) return;

  // 0. Xử lý khoảng ngày (Date Range: "YYYY-MM-DD..YYYY-MM-DD" hoặc "YYYY-MM-DD|YYYY-MM-DD")
  if (
    values.length === 1 &&
    (values[0].includes('..') || values[0].includes('|'))
  ) {
    const separator = values[0].includes('..') ? '..' : '|';
    const [fromDate, toDate] = values[0].split(separator);
    const filterExpr = getCaseColumnSelectExpr(column);
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
    const filterExpr = getCaseColumnSelectExpr(column);
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

  // 7. Cột đặc thù: margin / bienLoiNhuan (Biên lợi nhuận)
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

  // 8. Cột số tiền: doanhThu, chiPhi, loiNhuan
  if (column === 'doanhThu' || column === 'chiPhi' || column === 'loiNhuan') {
    const filterExpr = getCaseColumnSelectExpr(column);
    if (!filterExpr) return;

    const hasBlank = values.includes('__BLANK__');
    const realVals = values.filter((v) => v !== '__BLANK__');
    const numericVals = realVals.map((v) => Number(v)).filter((v) => !isNaN(v));

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

  const filterExpr = getCaseColumnSelectExpr(column);
  if (!filterExpr) return;

  // 9. Xử lý __BLANK__ (Lọc giá trị trống / null)
  const hasBlank = values.includes('__BLANK__');
  const realVals = values.filter((v) => v !== '__BLANK__');

  if (hasBlank && realVals.length > 0) {
    qb.andWhere(
      `(${filterExpr} IS NULL OR CAST(${filterExpr} AS TEXT) = '' OR CAST(${filterExpr} AS TEXT) IN (:...${paramPrefix}_vals))`,
      { [`${paramPrefix}_vals`]: realVals },
    );
  } else if (hasBlank) {
    qb.andWhere(`(${filterExpr} IS NULL OR CAST(${filterExpr} AS TEXT) = '')`);
  } else {
    qb.andWhere(`CAST(${filterExpr} AS TEXT) IN (:...${paramPrefix}_vals)`, {
      [`${paramPrefix}_vals`]: realVals,
    });
  }
}

/**
 * Áp dụng bộ lọc cho các cột khác khi lấy danh sách Distinct Options của 1 cột Vụ việc
 */
export function applyCaseOptionFilters(
  qb: SelectQueryBuilder<KgaraCase>,
  activeColumn: string,
  filtersStr?: string,
): void {
  if (!filtersStr) return;

  try {
    const filters = JSON.parse(filtersStr) as Record<string, string[]>;

    for (const [column, values] of Object.entries(filters)) {
      if (column === activeColumn) continue;
      if (!values || values.length === 0) continue;

      applySingleCaseColumnFilter(qb, column, values, `opt_${column}`);
    }
  } catch {
    // ignore malformed filter payloads
  }
}

/**
 * Áp dụng bộ lọc toàn bảng danh sách Vụ việc
 */
export function applyCaseListFilters(
  qb: SelectQueryBuilder<KgaraCase>,
  filtersStr?: string,
): void {
  if (!filtersStr) return;

  try {
    const filters = JSON.parse(filtersStr) as Record<string, string[]>;

    for (const [column, values] of Object.entries(filters)) {
      if (!values || values.length === 0) continue;

      applySingleCaseColumnFilter(qb, column, values, `list_${column}`);
    }
  } catch {
    // ignore malformed filter payloads
  }
}

/**
 * Ánh xạ tên cột sang biểu thức SQL cho truy vấn Hạng mục Dịch vụ (KgaraCaseService)
 */
export function getCaseServiceColumnSelectExpr(column: string): string | null {
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
    completionDate: 'TO_CHAR("c"."ngay_hoan_thanh_cong_viec", \'YYYY-MM-DD\')',
    hasLinkedInvoice:
      'CASE WHEN EXISTS (SELECT 1 FROM kgara_case_linked_invoice l WHERE l."caseDbId" = "c".id) THEN \'YES\' ELSE \'NO\' END',
  };

  return mapping[column] || null;
}

/**
 * Áp dụng bộ lọc cho 1 cột trên QueryBuilder của KgaraCaseService
 */
export function applySingleCaseServiceColumnFilter(
  qb: SelectQueryBuilder<KgaraCaseService>,
  column: string,
  values: string[],
  paramPrefix: string,
): void {
  if (!values || values.length === 0) return;

  // 0. Xử lý khoảng ngày (Date Range: "YYYY-MM-DD..YYYY-MM-DD" hoặc "YYYY-MM-DD|YYYY-MM-DD")
  if (
    values.length === 1 &&
    (values[0].includes('..') || values[0].includes('|'))
  ) {
    const separator = values[0].includes('..') ? '..' : '|';
    const [fromDate, toDate] = values[0].split(separator);
    const filterExpr = getCaseServiceColumnSelectExpr(column);
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
    const filterExpr = getCaseServiceColumnSelectExpr(column);
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
      qb.andWhere(`"srv"."loai_san_pham_code" IN (:...${paramPrefix}_types)`, {
        [`${paramPrefix}_types`]: filtered,
      });
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
    const filterExpr = getCaseServiceColumnSelectExpr(column);
    if (!filterExpr) return;

    const hasBlank = values.includes('__BLANK__');
    const realVals = values.filter((v) => v !== '__BLANK__');
    const numericVals = realVals.map((v) => Number(v)).filter((v) => !isNaN(v));

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
  const filterExpr = getCaseServiceColumnSelectExpr(column);
  if (!filterExpr) return;

  const hasBlank = values.includes('__BLANK__');
  const realVals = values.filter((v) => v !== '__BLANK__');

  if (hasBlank && realVals.length > 0) {
    qb.andWhere(
      `(${filterExpr} IS NULL OR CAST(${filterExpr} AS TEXT) = '' OR CAST(${filterExpr} AS TEXT) IN (:...${paramPrefix}_vals))`,
      { [`${paramPrefix}_vals`]: realVals },
    );
  } else if (hasBlank) {
    qb.andWhere(`(${filterExpr} IS NULL OR CAST(${filterExpr} AS TEXT) = '')`);
  } else {
    qb.andWhere(`CAST(${filterExpr} AS TEXT) IN (:...${paramPrefix}_vals)`, {
      [`${paramPrefix}_vals`]: realVals,
    });
  }
}

/**
 * Áp dụng bộ lọc cho bảng Hạng mục Dịch vụ (KgaraCaseService)
 */
export function applyCaseServiceFilters(
  qb: SelectQueryBuilder<KgaraCaseService>,
  filtersStr?: string,
  prefix: string = 'list_',
): void {
  if (!filtersStr) return;

  try {
    const filters = JSON.parse(filtersStr) as Record<string, string[]>;
    for (const [column, values] of Object.entries(filters)) {
      if (!values || values.length === 0) continue;
      applySingleCaseServiceColumnFilter(
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
