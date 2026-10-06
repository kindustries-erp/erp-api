import * as ExcelJS from 'exceljs';
import {
  initSheetStructure,
  applyStandardExcelReportLayout,
  borderThin,
  styleMarginCell,
  COMPLETED_CASES_COLUMNS,
  CASE_PNL_COLUMNS,
  COMPLETED_CASE_SERVICES_COLUMNS,
} from './kgara-excel-style.helper';

export const CLASSIFICATION_LABELS: Record<string, string> = {
  KY_GUI_NOI_BO: 'Ký gửi nội bộ',
  SUA_CHUA_CHUNG: 'Sửa chữa chung',
  OJ: 'Xe ngoài (OJ)',
  OJ_NGOAI: 'Xe ngoài (OJ)',
  KHAC: 'Khác',
};

export function formatDisplayDate(d?: Date | string | null): string {
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
}

export function highlightStatusCell(
  cell: ExcelJS.Cell,
  statusText: string,
): void {
  const s = statusText.toLowerCase();
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  if (
    s.includes('kết thúc') ||
    s.includes('hoàn thành') ||
    s.includes('hoàn tất') ||
    s.includes('giao xe') ||
    s.includes('xong') ||
    s.includes('đã thanh toán')
  ) {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFECFDF5' },
    };
    cell.font = {
      name: 'Calibri',
      size: 10,
      bold: true,
      color: { argb: 'FF065F46' },
    };
  } else if (
    s.includes('hủy') ||
    s.includes('từ chối') ||
    s.includes('không duyệt')
  ) {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFEE2E2' },
    };
    cell.font = {
      name: 'Calibri',
      size: 10,
      bold: true,
      color: { argb: 'FF991B1B' },
    };
  } else if (
    s.includes('đang sửa') ||
    s.includes('đang làm') ||
    s.includes('tiếp nhận') ||
    s.includes('đang xử lý') ||
    s.includes('kiểm tra') ||
    s.includes('sửa chữa')
  ) {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFEF3C7' },
    };
    cell.font = {
      name: 'Calibri',
      size: 10,
      bold: true,
      color: { argb: 'FF92400E' },
    };
  } else {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' },
    };
    cell.font = {
      name: 'Calibri',
      size: 10,
      bold: true,
      color: { argb: 'FF475569' },
    };
  }
}

/**
 * Sheet 1: Bảng kê phiếu kết thúc (Phương án 1: Cụm Thu & Cụm Trả với 2 cột Ghi chú riêng)
 */
export function buildSheet1CompletedCases(
  workbook: ExcelJS.Workbook,
  cases: any[],
  branchNameMap: Record<string, string>,
  linkedInvoiceSummaryMap: Record<string, string>,
  settlementsMap: Record<string, { receipts: number; payments: number }>,
): void {
  const sheet = workbook.addWorksheet('Bảng kê phiếu kết thúc');
  initSheetStructure(sheet, COMPLETED_CASES_COLUMNS);

  const sums: Record<string, number> = {
    phaiThu: 0,
    daThu: 0,
    conPhaiThu: 0,
    phaiTra: 0,
    daTra: 0,
    conPhaiTra: 0,
    doanhThu: 0,
    chiPhi: 0,
    loiNhuan: 0,
  };

  cases.forEach((c: any, idx: number) => {
    const rowIdx = idx + 5;
    const gp = c.grossProfit;
    const rev =
      (Number(c.doanhThu) > 0 ? Number(c.doanhThu) : 0) ||
      (Number(gp?.doanhThu) > 0 ? Number(gp?.doanhThu) : 0) ||
      Number(c.tienCoThue) ||
      0;
    const cost =
      (Number(c.chiPhi) > 0 ? Number(c.chiPhi) : 0) ||
      (Number(gp?.chiPhi) > 0 ? Number(gp?.chiPhi) : 0) ||
      0;
    const profit = rev - cost;
    const margin = rev > 0 ? (profit / rev) * 100 : 0;

    const setInfo = settlementsMap[c.id];
    const hasSettlement = setInfo !== undefined;
    const phaiThu = Number(c.tienCoThue) || rev;
    const daThu = hasSettlement
      ? setInfo.receipts
      : Number(c.tienDaThanhToan) || 0;
    const conPhaiThu = phaiThu - daThu;

    const phaiTra = cost;
    const daTra = hasSettlement
      ? setInfo.payments
      : Number(c.tienDaChi ?? c.rawData?.TienDaChi ?? 0);
    const conPhaiTra = phaiTra - daTra;

    const ghiChu = c.ghiChu || c.rawData?.GhiChu || '';
    const ghiChuThu = c.ghiChuThu || ghiChu;
    const ghiChuTra = c.ghiChuTra || '';

    sums.phaiThu += phaiThu;
    sums.daThu += daThu;
    sums.conPhaiThu += conPhaiThu;
    sums.phaiTra += phaiTra;
    sums.daTra += daTra;
    sums.conPhaiTra += conPhaiTra;
    sums.doanhThu += rev;
    sums.chiPhi += cost;
    sums.loiNhuan += profit;

    const branchName =
      branchNameMap[c.branchExternalId] || c.branchExternalId || '—';
    const classLabel = c.classification
      ? CLASSIFICATION_LABELS[c.classification] || c.classification
      : 'Sửa chữa chung';

    const row = sheet.addRow({
      index: idx + 1,
      soChungTu: c.soChungTu || '—',
      bienSoXe: c.bienSoXe || '—',
      khachHangCode: c.khachHangCode || '—',
      khachHangName: c.khachHangName || '—',
      tenTinhTrangDichVu: c.tenTinhTrangDichVu || 'Đã kết thúc',
      classification: classLabel,
      ngayTiepNhan: formatDisplayDate(c.ngayTiepNhan || c.ngayPhatSinh),
      ngayHoanThanhCongViec: formatDisplayDate(c.ngayHoanThanhCongViec),
      phaiThu,
      daThu,
      conPhaiThu: { formula: `J${rowIdx}-K${rowIdx}`, result: conPhaiThu },
      ghiChuThu,
      phaiTra,
      daTra,
      conPhaiTra: { formula: `N${rowIdx}-O${rowIdx}`, result: conPhaiTra },
      ghiChuTra,
      doanhThu: rev,
      chiPhi: cost,
      loiNhuan: { formula: `R${rowIdx}-S${rowIdx}`, result: profit },
      margin: {
        formula: `IF(R${rowIdx}>0, T${rowIdx}/R${rowIdx}, 0)`,
        result: margin / 100,
      },
      linkedInvoices: linkedInvoiceSummaryMap[c.id] || '—',
      branchName,
    });

    row.height = 20;
    row.font = { name: 'Calibri', size: 10 };
    row.alignment = { vertical: 'middle' };

    for (let col = 1; col <= COMPLETED_CASES_COLUMNS.length; col++) {
      const colDef = COMPLETED_CASES_COLUMNS[col - 1];
      const cell = row.getCell(col);
      cell.border = borderThin;
      if (colDef.style?.numFmt) cell.numFmt = colDef.style.numFmt;
      if (colDef.align)
        cell.alignment = { horizontal: colDef.align, vertical: 'middle' };
    }

    // Styling background màu kem/pastel dịu mắt cho 2 cột Ghi chú thu & Ghi chú trả
    const ghiChuThuCell = row.getCell('ghiChuThu');
    ghiChuThuCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFBEB' }, // Soft pastel amber/cream
    };
    ghiChuThuCell.font = {
      name: 'Calibri',
      size: 10,
      color: { argb: 'FF1E293B' },
    };

    const ghiChuTraCell = row.getCell('ghiChuTra');
    ghiChuTraCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFBEB' }, // Soft pastel amber/cream
    };
    ghiChuTraCell.font = {
      name: 'Calibri',
      size: 10,
      color: { argb: 'FF1E293B' },
    };

    highlightStatusCell(
      row.getCell('tenTinhTrangDichVu'),
      String(c.tenTinhTrangDichVu || 'Đã kết thúc'),
    );

    // Áp dụng 6 dải màu tương phản cao cho cột Biên LN (%)
    styleMarginCell(row.getCell('margin'), margin);
  });

  applyStandardExcelReportLayout(sheet, COMPLETED_CASES_COLUMNS, 5, sums, {
    sumRow: { margin: 'IF(R1>0, (T1/R1), 0)' },
    subtotalRow: { margin: 'IF(R2>0, (T2/R2), 0)' },
  });
}

/**
 * Sheet 2: Theo dõi lãi lỗ (Chuyên sâu phân tích Hiệu quả, Lợi nhuận & 5 Dải màu Biên LN)
 */
export function buildSheet2PnlTracking(
  workbook: ExcelJS.Workbook,
  cases: any[],
  branchNameMap: Record<string, string>,
  serviceLinesMap: Map<string, any[]>,
): void {
  const sheet = workbook.addWorksheet('Theo dõi lãi lỗ');
  initSheetStructure(sheet, CASE_PNL_COLUMNS);

  const sums: Record<string, number> = {
    doanhThuDichVu: 0,
    doanhThuPhuTung: 0,
    doanhThu: 0,
    giaVonPhuTung: 0,
    chiPhiKhac: 0,
    chiPhi: 0,
    loiNhuan: 0,
  };

  cases.forEach((c: any, idx: number) => {
    const rowIdx = idx + 5;
    const gp = c.grossProfit;
    const rawRev =
      (Number(c.doanhThu) > 0 ? Number(c.doanhThu) : 0) ||
      (Number(gp?.doanhThu) > 0 ? Number(gp?.doanhThu) : 0) ||
      Number(c.tienCoThue) ||
      0;
    const rawCost =
      (Number(c.chiPhi) > 0 ? Number(c.chiPhi) : 0) ||
      (Number(gp?.chiPhi) > 0 ? Number(gp?.chiPhi) : 0) ||
      0;

    const lines = c.hdPhieuDichVuId
      ? serviceLinesMap.get(c.hdPhieuDichVuId) || []
      : [];
    let dtDv = 0;
    let dtPt = 0;
    let gvPt = 0;

    for (const line of lines) {
      const loaiCode = line.loaiSanPhamCode || line.LoaiSanPhamCode || '';
      const loaiChiTiet = line.loaiChiTiet ?? line.LoaiChiTiet;
      const nhomIn = (line.nhomInName || line.NhomInName || '').toLowerCase();
      const pt = Number(line.tienPhuTung ?? line.TienPhuTung ?? 0);
      const gv = Number(line.giaVonPhuTung ?? line.GiaVonPhuTung ?? 0);
      const dv = Number(line.tienDichVu ?? line.TienDichVu ?? 0);
      const isPt =
        loaiCode === 'PT' ||
        loaiChiTiet === 1 ||
        loaiChiTiet === 4 ||
        nhomIn.includes('phụ tùng') ||
        nhomIn.includes('vật tư') ||
        pt > 0;

      if (isPt) {
        dtPt += pt > 0 ? pt : Number(line.tienCoThue ?? line.TienCoThue ?? 0);
        gvPt += gv;
      } else {
        dtDv += dv > 0 ? dv : Number(line.tienCoThue ?? line.TienCoThue ?? 0);
      }
    }

    const rev = rawRev > 0 ? rawRev : dtDv + dtPt > 0 ? dtDv + dtPt : 0;
    if (dtDv === 0 && dtPt === 0 && rev > 0) dtDv = rev;
    const cpKhac = Math.max(0, rawCost - gvPt);
    const cost = rawCost > 0 ? rawCost : gvPt;
    const profit = rev - cost;
    const margin = rev > 0 ? (profit / rev) * 100 : 0;

    sums.doanhThuDichVu += dtDv;
    sums.doanhThuPhuTung += dtPt;
    sums.doanhThu += rev;
    sums.giaVonPhuTung += gvPt;
    sums.chiPhiKhac += cpKhac;
    sums.chiPhi += cost;
    sums.loiNhuan += profit;

    const branchName =
      branchNameMap[c.branchExternalId] || c.branchExternalId || '—';
    const classLabel = c.classification
      ? CLASSIFICATION_LABELS[c.classification] || c.classification
      : 'Sửa chữa chung';

    const row = sheet.addRow({
      index: idx + 1,
      soChungTu: c.soChungTu || '—',
      bienSoXe: c.bienSoXe || '—',
      khachHangName: c.khachHangName || '—',
      classification: classLabel,
      ngayHoanThanhCongViec: formatDisplayDate(c.ngayHoanThanhCongViec),
      doanhThuDichVu: dtDv,
      doanhThuPhuTung: dtPt,
      doanhThu: { formula: `G${rowIdx}+H${rowIdx}`, result: rev },
      giaVonPhuTung: gvPt,
      chiPhiKhac: cpKhac,
      chiPhi: { formula: `J${rowIdx}+K${rowIdx}`, result: cost },
      loiNhuan: { formula: `I${rowIdx}-L${rowIdx}`, result: profit },
      margin: {
        formula: `IF(I${rowIdx}>0, M${rowIdx}/I${rowIdx}, 0)`,
        result: margin / 100,
      },
      branchName,
    });

    row.height = 20;
    row.font = { name: 'Calibri', size: 10 };
    row.alignment = { vertical: 'middle' };

    for (let col = 1; col <= CASE_PNL_COLUMNS.length; col++) {
      const colDef = CASE_PNL_COLUMNS[col - 1];
      const cell = row.getCell(col);
      cell.border = borderThin;
      if (colDef.style?.numFmt) cell.numFmt = colDef.style.numFmt;
      if (colDef.align)
        cell.alignment = { horizontal: colDef.align, vertical: 'middle' };
    }

    // Áp dụng 6 dải màu tương phản cao cho cột Biên LN (%)
    styleMarginCell(row.getCell('margin'), margin);
  });

  applyStandardExcelReportLayout(sheet, CASE_PNL_COLUMNS, 4, sums, {
    sumRow: { margin: 'IF(I1>0, (M1/I1), 0)' },
    subtotalRow: { margin: 'IF(I2>0, (M2/I2), 0)' },
  });
}

/**
 * Sheet 3: Chi tiết DV & Phụ tùng
 */
export function buildSheet3ItemizedServices(
  workbook: ExcelJS.Workbook,
  cases: any[],
  serviceLinesMap: Map<string, any[]>,
): void {
  const sheet = workbook.addWorksheet('Chi tiết DV & Phụ tùng');
  initSheetStructure(sheet, COMPLETED_CASE_SERVICES_COLUMNS);

  const sums = {
    soLuongHoaDon: 0,
    tienChuaThue: 0,
    tienCoThue: 0,
    soGioCongLam: 0,
    tienDichVu: 0,
    tienPhuTung: 0,
    giaVonPhuTung: 0,
    tienChietKhauCt: 0,
  };

  let lineIdx = 0;
  for (const c of cases) {
    if (!c.hdPhieuDichVuId) continue;
    const lines = serviceLinesMap.get(c.hdPhieuDichVuId) || [];
    for (const line of lines) {
      lineIdx++;
      const loaiCode = line.loaiSanPhamCode || line.LoaiSanPhamCode || '';
      const pt = Number(line.tienPhuTung ?? line.TienPhuTung ?? 0);
      const loaiChiTiet = line.loaiChiTiet ?? line.LoaiChiTiet;
      const nhomIn = (line.nhomInName || line.NhomInName || '').toLowerCase();
      const isPt =
        loaiCode === 'PT' ||
        loaiChiTiet === 1 ||
        loaiChiTiet === 4 ||
        nhomIn.includes('phụ tùng') ||
        nhomIn.includes('vật tư') ||
        pt > 0;

      const soLuongHoaDon = Number(
        line.soLuongHoaDon ?? line.SoLuongHoaDon ?? 0,
      );
      const donGia = Number(line.donGia ?? line.DonGia ?? 0);
      const tienChuaThue = Number(line.tienChuaThue ?? line.TienChuaThue ?? 0);
      const thueSuat =
        Number(line.thueSuat ?? line.ThueSuat ?? 0) > 1
          ? Number(line.thueSuat ?? line.ThueSuat ?? 0) / 100
          : Number(line.thueSuat ?? line.ThueSuat ?? 0);
      const tienCoThue = Number(line.tienCoThue ?? line.TienCoThue ?? 0);
      const soGioCongLam = Number(line.soGioCongLam ?? line.SoGioCongLam ?? 0);
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

      sums.soLuongHoaDon += soLuongHoaDon;
      sums.tienChuaThue += tienChuaThue;
      sums.tienCoThue += tienCoThue;
      sums.soGioCongLam += soGioCongLam;
      sums.tienDichVu += tienDichVu;
      sums.tienPhuTung += pt;
      sums.giaVonPhuTung += giaVonPhuTung;
      sums.tienChietKhauCt += tienChietKhauCt;

      const row = sheet.addRow({
        index: lineIdx,
        soChungTu: c.soChungTu || '—',
        bienSoXe: c.bienSoXe || '—',
        loaiHienThi: isPt ? 'Phụ tùng' : 'Dịch vụ',
        sanPhamCode: line.sanPhamCode || line.SanPhamCode || '—',
        sanPhamName:
          line.sanPhamName ||
          line.SanPhamName ||
          line.noiDungChiTiet ||
          line.NoiDungChiTiet ||
          '—',
        noiDungChiTiet: line.noiDungChiTiet || line.NoiDungChiTiet || '—',
        donViTinhText: line.donViTinhText || line.DonViTinhText || '—',
        soLuongHoaDon,
        donGia,
        tienChuaThue,
        thueSuat,
        tienCoThue,
        soGioCongLam,
        tienDichVu,
        tienPhuTung: pt,
        giaVonPhuTung,
        tienChietKhauCt,
        khoCode: line.khoCode || line.KhoCode || line.KhoName || '—',
        ghiChu:
          line.ghiChu ||
          line.GhiChuChiTiet ||
          (line.TienPhuPhi || line.tienPhuPhi
            ? `Phụ phí: ${line.TienPhuPhi || line.tienPhuPhi}`
            : '—'),
      });

      row.height = 20;
      row.font = { name: 'Calibri', size: 10 };
      row.alignment = { vertical: 'middle' };

      for (let col = 1; col <= COMPLETED_CASE_SERVICES_COLUMNS.length; col++) {
        const colDef = COMPLETED_CASE_SERVICES_COLUMNS[col - 1];
        const cell = row.getCell(col);
        cell.border = borderThin;
        if (colDef.style?.numFmt) cell.numFmt = colDef.style.numFmt;
        if (colDef.align)
          cell.alignment = { horizontal: colDef.align, vertical: 'middle' };
      }
    }
  }

  applyStandardExcelReportLayout(
    sheet,
    COMPLETED_CASE_SERVICES_COLUMNS,
    6,
    sums,
  );
}
