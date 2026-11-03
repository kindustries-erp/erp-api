import * as ExcelJS from 'exceljs';
import type { CaseLedgerAmounts } from '../hub/handlers/garage-case-ledger.handler';
import {
  initSheetStructure,
  applyForecastColumnStyle,
  applyStandardExcelReportLayout,
  borderThin,
  styleMarginCell,
  getExcelColumnLetter,
  applyColumnGroupStyles,
  COMPLETED_CASES_COLUMNS,
  COMPLETED_CASES_ALL_COLUMNS,
  CASE_PNL_COLUMNS,
  CASE_PNL_COLUMN_GROUPS,
  COMPLETED_CASE_SERVICES_COLUMNS,
  type ExcelReportColumnDef,
} from './kgara-excel-style.helper';
import { resolveCaseVatAmount } from './kgara-case-financial-parser.helper';

export const CLASSIFICATION_LABELS: Record<string, string> = {
  KY_GUI_NOI_BO: 'Ký gửi nội bộ',
  SUA_CHUA_CHUNG: 'Sửa chữa chung',
  OJ: 'Xe ngoài (OJ)',
  OJ_NGOAI: 'Xe ngoài (OJ)',
  KHAC: 'Khác',
};

/**
 * Ngày làm giá trị ô Excel (kiểu ngày thật, để lọc/nhóm/pivot). Lấy ngày/giờ theo getter
 * local, cùng cách hiển thị cũ, rồi dựng Date theo thành phần UTC để ExcelJS ghi đúng
 * ngày giờ đó. `null` khi trống để ô để trống.
 */
export function toExcelWallClockDate(
  value: Date | string | null | undefined,
  withTime = false,
): Date | null {
  if (!value) return null;
  const dt = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(dt.getTime())) return null;
  return new Date(
    Date.UTC(
      dt.getFullYear(),
      dt.getMonth(),
      dt.getDate(),
      withTime ? dt.getHours() : 0,
      withTime ? dt.getMinutes() : 0,
    ),
  );
}

/** Mô tả quy tắc loại trừ; không loại trừ thì trả về `—`. */
export function formatExclusionRules(item: Record<string, any>): string {
  const rules = [
    item.excludeFromReports ? 'Loại khỏi báo cáo' : null,
    item.excludeFromDebt ? 'Loại khỏi công nợ' : null,
  ].filter(Boolean);
  return rules.length ? rules.join('; ') : '—';
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

export const SHEET1_NAME = 'Bảng kê phiếu kết thúc';
/** Dòng dữ liệu đầu tiên của Sheet 1 (sau 4 dòng cấu trúc). */
export const SHEET1_FIRST_DATA_ROW = 5;

/** Dữ liệu từng phiếu sau khi chuẩn hóa, dùng dựng Dashboard (cùng nguồn với Sheet 1). */
export interface CaseDashboardRow {
  caseNo: string;
  customerName: string;
  classification: string;
  receivedDate: Date | null;
  completionDate: Date | null;
  issuedDate: Date | null;
  revenue: number;
  cost: number;
  profit: number;
  receivable: number;
  payable: number;
  /** Đã thu/đã trả theo settlement; dự thu/dự chi theo phiếu chưa thực tế. */
  received: number;
  paid: number;
  expected: number;
  planned: number;
}

export interface Sheet1Summary {
  sums: Record<string, number>;
  rows: CaseDashboardRow[];
  /** Cột thực tế của Sheet 1 (sau khi chọn cột); Dashboard dựa vào đây để tham chiếu. */
  columns: ExcelReportColumnDef[];
}

/**
 * Lọc cột Sheet 1 theo `selectedKeys`, giữ thứ tự gốc.
 * Trống hoặc không khớp key nào → toàn bộ cột mặc định.
 */
export function resolveCompletedCasesColumns(
  selectedKeys?: string[],
): ExcelReportColumnDef[] {
  if (!selectedKeys?.length) return COMPLETED_CASES_COLUMNS;
  const picked = new Set(selectedKeys);
  const columns = COMPLETED_CASES_ALL_COLUMNS.filter((c) => picked.has(c.key));
  return columns.length ? columns : COMPLETED_CASES_COLUMNS;
}

const toDateOrNull = (v: unknown): Date | null => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v as string);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * Sheet 1: Bảng kê phiếu kết thúc (Phương án 1: Cụm Thu & Cụm Trả với 2 cột Ghi chú riêng)
 * Trả về tổng và các dòng chuẩn hóa để Dashboard dùng đúng số liệu của sheet này.
 */
export function buildSheet1CompletedCases(
  workbook: ExcelJS.Workbook,
  cases: any[],
  branchNameMap: Record<string, string>,
  linkedInvoiceSummaryMap: Record<string, string>,
  settlementsMap: Record<string, { receipts: number; payments: number }>,
  serviceLinesMap?: Map<string, any[]>,
  caseLedgerMap: Record<string, CaseLedgerAmounts> = {},
  selectedColumns?: string[],
  linkedInvoiceVatMap: Record<string, number> = {},
): Sheet1Summary {
  const sheet = workbook.addWorksheet(SHEET1_NAME);
  const dashboardRows: CaseDashboardRow[] = [];
  const columns = resolveCompletedCasesColumns(selectedColumns);
  const hasColumn = (key: string) => columns.some((c) => c.key === key);
  /** Tham chiếu ô theo vị trí cột đang xuất; null nếu cột không được chọn. */
  const cellRef = (key: string, rowNo: number): string | null => {
    const idx = columns.findIndex((c) => c.key === key);
    return idx < 0 ? null : `${getExcelColumnLetter(idx + 1)}${rowNo}`;
  };
  /** Công thức ghép ô; nếu thiếu cột nguồn thì chỉ giữ giá trị. */
  const formulaOrValue = (
    keys: string[],
    rowNo: number,
    build: (refs: string[]) => string,
    result: number,
  ): ExcelJS.CellFormulaValue | number => {
    const refs = keys.map((k) => cellRef(k, rowNo));
    if (refs.some((r) => r === null)) return result;
    return { formula: build(refs as string[]), result };
  };
  /** Cộng hai cột: dùng SUM(a:b) khi hai cột liền nhau, ngược lại ghép `a+b`. */
  const sumBuild =
    (first: string, second: string) =>
    (refs: string[]): string => {
      const i = columns.findIndex((c) => c.key === first);
      const adjacent = columns[i + 1]?.key === second;
      return adjacent ? `SUM(${refs[0]}:${refs[1]})` : `${refs[0]}+${refs[1]}`;
    };
  const marginFormula = (rowNo: number): string | null => {
    const rev = cellRef('doanhThu', rowNo);
    const profit = cellRef('loiNhuan', rowNo);
    if (!rev || !profit) return null;
    return `IF(${rev}>0, (${profit}/${rev}), 0)`;
  };
  initSheetStructure(sheet, columns);

  const sums: Record<string, number> = {
    phaiThuBaoHiem: 0,
    phaiThuKhachHang: 0,
    phaiThu: 0,
    daThu: 0,
    conPhaiThu: 0,
    chiPhiNhanCong: 0,
    chiPhiPhuTung: 0,
    phaiTra: 0,
    daTra: 0,
    conPhaiTra: 0,
    doanhThu: 0,
    chiPhi: 0,
    loiNhuan: 0,
    margin: 0,
    duThu: 0,
    duChi: 0,
    vatAmount: 0,
  };

  cases.forEach((c: any, idx: number) => {
    const rowIdx = idx + SHEET1_FIRST_DATA_ROW;
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

    const raw = c.rawData;
    const phaiThuBaoHiem = (() => {
      if (raw?.TienThanhToanBH != null && !isNaN(Number(raw.TienThanhToanBH))) {
        return Number(raw.TienThanhToanBH);
      }
      if (
        raw?.XeLamBaoHiem === true &&
        raw?.TienBaoHiemDuyet != null &&
        !isNaN(Number(raw.TienBaoHiemDuyet)) &&
        Number(raw.TienBaoHiemDuyet) > 0
      ) {
        return Number(raw.TienBaoHiemDuyet);
      }
      return 0;
    })();

    const phaiThuKhachHang = (() => {
      if (raw?.TienThanhToanKH != null && !isNaN(Number(raw.TienThanhToanKH))) {
        return Number(raw.TienThanhToanKH);
      }
      if (!raw?.XeLamBaoHiem) {
        return phaiThu;
      }
      return Math.max(0, phaiThu - phaiThuBaoHiem);
    })();

    const phaiTra = cost;
    const daTra = hasSettlement
      ? setInfo.payments
      : Number(c.tienDaChi ?? c.rawData?.TienDaChi ?? 0);
    const conPhaiTra = phaiTra - daTra;

    const lines = c.hdPhieuDichVuId
      ? serviceLinesMap?.get(c.hdPhieuDichVuId) || []
      : [];
    // Ưu tiên VAT của hóa đơn đầu ra liên kết; không có thì dùng nguồn dự phòng.
    const vatAmount =
      linkedInvoiceVatMap[c.id] ?? resolveCaseVatAmount(c, lines);
    let gvPt = 0;
    for (const line of lines) {
      const loaiCode = line.loaiSanPhamCode || line.LoaiSanPhamCode || '';
      const loaiChiTiet = line.loaiChiTiet ?? line.LoaiChiTiet;
      const nhomIn = (line.nhomInName || line.NhomInName || '').toLowerCase();
      const pt = Number(line.tienPhuTung ?? line.TienPhuTung ?? 0);
      const gv = Number(line.giaVonPhuTung ?? line.GiaVonPhuTung ?? 0);
      const isPt =
        loaiCode === 'PT' ||
        loaiChiTiet === 1 ||
        loaiChiTiet === 4 ||
        nhomIn.includes('phụ tùng') ||
        nhomIn.includes('vật tư') ||
        pt > 0;
      if (isPt) {
        gvPt += gv;
      }
    }
    const chiPhiPhuTung = gvPt;
    const chiPhiNhanCong = Math.max(0, phaiTra - gvPt);

    const ledger = caseLedgerMap[c.id];
    const duThu = ledger?.expectedIn ?? 0;
    const duChi = ledger?.plannedOut ?? 0;

    const ghiChu = c.ghiChu || c.rawData?.GhiChu || '';
    const ghiChuThu = c.ghiChuThu || ghiChu;
    const ghiChuTra = c.ghiChuTra || '';

    sums.phaiThuBaoHiem += phaiThuBaoHiem;
    sums.phaiThuKhachHang += phaiThuKhachHang;
    sums.phaiThu += phaiThu;
    sums.daThu += daThu;
    sums.conPhaiThu += conPhaiThu;
    sums.chiPhiNhanCong += chiPhiNhanCong;
    sums.chiPhiPhuTung += chiPhiPhuTung;
    sums.phaiTra += phaiTra;
    sums.daTra += daTra;
    sums.conPhaiTra += conPhaiTra;
    sums.doanhThu += rev;
    sums.chiPhi += cost;
    sums.loiNhuan += profit;
    sums.duThu += duThu;
    sums.duChi += duChi;
    sums.vatAmount += vatAmount;

    const branchName =
      branchNameMap[c.branchExternalId] || c.branchExternalId || '—';
    const classLabel = c.classification
      ? CLASSIFICATION_LABELS[c.classification] || c.classification
      : 'Sửa chữa chung';

    dashboardRows.push({
      caseNo: c.soChungTu || '—',
      customerName: c.khachHangName || '—',
      classification: classLabel,
      receivedDate: toDateOrNull(c.ngayTiepNhan),
      completionDate: toDateOrNull(c.ngayHoanThanhCongViec),
      issuedDate: toDateOrNull(c.ngayPhatSinh),
      revenue: rev,
      cost,
      profit,
      receivable: conPhaiThu,
      payable: conPhaiTra,
      received: daThu,
      paid: daTra,
      expected: duThu,
      planned: duChi,
    });

    const values: Record<string, unknown> = {
      index: idx + 1,
      soChungTu: c.soChungTu || '—',
      bienSoXe: c.bienSoXe || '—',
      khachHangCode: c.khachHangCode || '—',
      khachHangName: c.khachHangName || '—',
      tenTinhTrangDichVu: c.tenTinhTrangDichVu || 'Đã kết thúc',
      classification: classLabel,
      ngayTiepNhan: toExcelWallClockDate(c.ngayTiepNhan || c.ngayPhatSinh),
      ngayHoanThanhCongViec: toExcelWallClockDate(c.ngayHoanThanhCongViec),
      phaiThuBaoHiem,
      phaiThuKhachHang,
      phaiThu: formulaOrValue(
        ['phaiThuBaoHiem', 'phaiThuKhachHang'],
        rowIdx,
        sumBuild('phaiThuBaoHiem', 'phaiThuKhachHang'),
        phaiThu,
      ),
      daThu,
      conPhaiThu: formulaOrValue(
        ['phaiThu', 'daThu'],
        rowIdx,
        ([a, b]) => `${a}-${b}`,
        conPhaiThu,
      ),
      ghiChuThu,
      chiPhiNhanCong,
      chiPhiPhuTung,
      phaiTra: formulaOrValue(
        ['chiPhiNhanCong', 'chiPhiPhuTung'],
        rowIdx,
        sumBuild('chiPhiNhanCong', 'chiPhiPhuTung'),
        phaiTra,
      ),
      daTra,
      conPhaiTra: formulaOrValue(
        ['phaiTra', 'daTra'],
        rowIdx,
        ([a, b]) => `${a}-${b}`,
        conPhaiTra,
      ),
      ghiChuTra,
      doanhThu: rev,
      chiPhi: cost,
      loiNhuan: formulaOrValue(
        ['doanhThu', 'chiPhi'],
        rowIdx,
        ([a, b]) => `${a}-${b}`,
        profit,
      ),
      margin: formulaOrValue(
        ['doanhThu', 'loiNhuan'],
        rowIdx,
        ([rev, profitRef]) => `IF(${rev}>0, ${profitRef}/${rev}, 0)`,
        margin / 100,
      ),
      linkedInvoices: linkedInvoiceSummaryMap[c.id] || '—',
      branchName,
      duThu,
      duChi,
      vatAmount,
      exclusionRules: formatExclusionRules(c),
      createdAt: toExcelWallClockDate(c.createdAt, true),
      updatedAt: toExcelWallClockDate(c.updatedAt, true),
      dataAsOf: toExcelWallClockDate(c.dataAsOf, true),
    };

    const row = sheet.addRow(
      Object.fromEntries(columns.map((col) => [col.key, values[col.key]])),
    );

    row.height = 20;
    row.font = { name: 'Calibri', size: 10 };
    row.alignment = { vertical: 'middle' };

    for (let col = 1; col <= columns.length; col++) {
      const colDef = columns[col - 1];
      const cell = row.getCell(col);
      cell.border = borderThin;
      if (colDef.style?.numFmt) cell.numFmt = colDef.style.numFmt;
      if (colDef.align)
        cell.alignment = { horizontal: colDef.align, vertical: 'middle' };
    }

    // Styling background màu kem/pastel dịu mắt cho 2 cột Ghi chú thu & Ghi chú trả
    for (const noteKey of ['ghiChuThu', 'ghiChuTra']) {
      if (!hasColumn(noteKey)) continue;
      const noteCell = row.getCell(noteKey);
      noteCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFFBEB' }, // Soft pastel amber/cream
      };
      noteCell.font = {
        name: 'Calibri',
        size: 10,
        color: { argb: 'FF1E293B' },
      };
    }

    if (hasColumn('tenTinhTrangDichVu')) {
      highlightStatusCell(
        row.getCell('tenTinhTrangDichVu'),
        String(c.tenTinhTrangDichVu || 'Đã kết thúc'),
      );
    }

    // Áp dụng 6 dải màu tương phản cao cho cột Biên LN (%)
    if (hasColumn('margin')) styleMarginCell(row.getCell('margin'), margin);
  });

  sums.margin = sums.doanhThu > 0 ? sums.loiNhuan / sums.doanhThu : 0;

  const labelIdx = Math.max(
    1,
    columns.findIndex((c) => c.key === 'khachHangName') + 1,
  );
  const marginSum = marginFormula(1);
  const marginSub = marginFormula(2);
  applyStandardExcelReportLayout(sheet, columns, labelIdx, sums, {
    sumRow: marginSum && hasColumn('margin') ? { margin: marginSum } : {},
    subtotalRow: marginSub && hasColumn('margin') ? { margin: marginSub } : {},
  });
  applyColumnGroupStyles(sheet, columns, SHEET1_FIRST_DATA_ROW);
  for (const key of ['duThu', 'duChi']) {
    const forecastIdx = columns.findIndex((c) => c.key === key);
    if (forecastIdx >= 0) applyForecastColumnStyle(sheet, forecastIdx + 1);
  }

  return { sums, rows: dashboardRows, columns };
}

/**
 * Sheet 2: Theo dõi lãi lỗ (Chuyên sâu phân tích Hiệu quả, Lợi nhuận & 5 Dải màu Biên LN)
 */
export function buildSheet2PnlTracking(
  workbook: ExcelJS.Workbook,
  cases: any[],
  branchNameMap: Record<string, string>,
  serviceLinesMap: Map<string, any[]>,
  linkedInvoiceVatMap: Record<string, number> = {},
): void {
  const sheet = workbook.addWorksheet('Theo dõi lãi lỗ');
  initSheetStructure(sheet, CASE_PNL_COLUMNS);

  /** Chữ cột theo vị trí thực trong CASE_PNL_COLUMNS, để công thức không lệch khi thêm cột. */
  const letter = (key: string) =>
    getExcelColumnLetter(CASE_PNL_COLUMNS.findIndex((c) => c.key === key) + 1);

  const sums: Record<string, number> = {
    doanhThuDichVu: 0,
    doanhThuPhuTung: 0,
    vatAmount: 0,
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
    // Ưu tiên VAT của hóa đơn đầu ra liên kết; không có thì dùng nguồn dự phòng (giống Sheet 1).
    const vatAmount =
      linkedInvoiceVatMap[c.id] ?? resolveCaseVatAmount(c, lines);

    sums.doanhThuDichVu += dtDv;
    sums.doanhThuPhuTung += dtPt;
    sums.vatAmount += vatAmount;
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
      ngayHoanThanhCongViec: toExcelWallClockDate(c.ngayHoanThanhCongViec),
      doanhThuDichVu: dtDv,
      doanhThuPhuTung: dtPt,
      vatAmount,
      doanhThu: {
        formula: `${letter('doanhThuDichVu')}${rowIdx}+${letter('doanhThuPhuTung')}${rowIdx}`,
        result: rev,
      },
      giaVonPhuTung: gvPt,
      chiPhiKhac: cpKhac,
      chiPhi: {
        formula: `${letter('giaVonPhuTung')}${rowIdx}+${letter('chiPhiKhac')}${rowIdx}`,
        result: cost,
      },
      loiNhuan: {
        formula: `${letter('doanhThu')}${rowIdx}-${letter('chiPhi')}${rowIdx}`,
        result: profit,
      },
      margin: {
        formula: `IF(${letter('doanhThu')}${rowIdx}>0, ${letter('loiNhuan')}${rowIdx}/${letter('doanhThu')}${rowIdx}, 0)`,
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

  const marginAt = (rowNo: number) =>
    `IF(${letter('doanhThu')}${rowNo}>0, (${letter('loiNhuan')}${rowNo}/${letter('doanhThu')}${rowNo}), 0)`;
  applyStandardExcelReportLayout(sheet, CASE_PNL_COLUMNS, 4, sums, {
    sumRow: { margin: marginAt(1) },
    subtotalRow: { margin: marginAt(2) },
  });
  applyColumnGroupStyles(sheet, CASE_PNL_COLUMNS, 5, CASE_PNL_COLUMN_GROUPS);
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
