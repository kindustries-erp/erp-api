import { Injectable } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { KgaraCashflowVoucher } from '../entities/kgara_cashflow_voucher.entity';
import { toVietnamExcelDate } from '../../common/utils/date.util';
import { classifyVoucher } from '../helpers/garage-ledger-classifier';
import { applyForecastColumnStyle } from '../helpers/kgara-excel-style.helper';

export interface GarageCashflowExcelBuildOptions {
  vouchers: KgaraCashflowVoucher[];
  selectedColumns?: string[];
  onProgress?: (percent: number, message: string) => void;
}

export interface CashflowColumnDefinition {
  header: string;
  key: string;
  width: number;
  style?: { numFmt?: string };
  isSum?: boolean;
}

@Injectable()
export class GarageCashflowExcelBuilder {
  private static readonly ALIGNMENTS: Record<
    string,
    { horizontal: 'center' | 'left' | 'right'; vertical: 'middle' }
  > = {
    stt: { horizontal: 'center', vertical: 'middle' },
    transDate: { horizontal: 'center', vertical: 'middle' },
    voucherCode: { horizontal: 'center', vertical: 'middle' },
    thu: { horizontal: 'right', vertical: 'middle' },
    chi: { horizontal: 'right', vertical: 'middle' },
    duThu: { horizontal: 'right', vertical: 'middle' },
    duChi: { horizontal: 'right', vertical: 'middle' },
    paymentStatus: { horizontal: 'center', vertical: 'middle' },
    paymentMethod: { horizontal: 'center', vertical: 'middle' },
    paymentContent: { horizontal: 'left', vertical: 'middle' },
    caseCode: { horizontal: 'center', vertical: 'middle' },
    licensePlate: { horizontal: 'center', vertical: 'middle' },
    partnerName: { horizontal: 'left', vertical: 'middle' },
    note: { horizontal: 'left', vertical: 'middle' },
    createdBy: { horizontal: 'left', vertical: 'middle' },
    createdAt: { horizontal: 'center', vertical: 'middle' },
    updatedBy: { horizontal: 'left', vertical: 'middle' },
    updatedAt: { horizontal: 'center', vertical: 'middle' },
  };

  async build(options: GarageCashflowExcelBuildOptions): Promise<Buffer> {
    const { vouchers, selectedColumns, onProgress } = options;
    onProgress?.(65, 'Đang tạo cấu trúc bảng tính Excel...');

    const workbook = new Workbook();
    const sheetName = 'Thu chi Garage';
    const worksheet = workbook.addWorksheet(sheetName);

    const allColumns: CashflowColumnDefinition[] = [
      { header: 'STT', key: 'stt', width: 8 },
      {
        header: 'Ngày chứng từ',
        key: 'transDate',
        width: 16,
        style: { numFmt: 'dd/mm/yyyy' },
      },
      { header: 'Mã phiếu', key: 'voucherCode', width: 24 },
      {
        header: 'Tiền vào (Thu)',
        key: 'thu',
        width: 18,
        style: { numFmt: '#,##0' },
        isSum: true,
      },
      {
        header: 'Tiền ra (Chi)',
        key: 'chi',
        width: 18,
        style: { numFmt: '#,##0' },
        isSum: true,
      },
      // Dự thu/dự chi: phiếu chưa thực tế, không cộng vào Thu/Chi
      {
        header: 'Dự thu',
        key: 'duThu',
        width: 18,
        style: { numFmt: '#,##0' },
        isSum: true,
      },
      {
        header: 'Dự chi',
        key: 'duChi',
        width: 18,
        style: { numFmt: '#,##0' },
        isSum: true,
      },
      { header: 'Trạng thái', key: 'paymentStatus', width: 16 },
      { header: 'Phương thức TT', key: 'paymentMethod', width: 18 },
      { header: 'Nội dung TT', key: 'paymentContent', width: 25 },
      { header: 'Mã PDV', key: 'caseCode', width: 20 },
      { header: 'Biển số xe', key: 'licensePlate', width: 16 },
      { header: 'Đối tác', key: 'partnerName', width: 32 },
      { header: 'Ghi chú / Diễn giải', key: 'note', width: 38 },
      { header: 'Người tạo', key: 'createdBy', width: 20 },
      {
        header: 'Ngày tạo',
        key: 'createdAt',
        width: 22,
        style: { numFmt: 'dd/mm/yyyy hh:mm:ss' },
      },
      { header: 'Người cập nhật', key: 'updatedBy', width: 20 },
      {
        header: 'Ngày cập nhật',
        key: 'updatedAt',
        width: 22,
        style: { numFmt: 'dd/mm/yyyy hh:mm:ss' },
      },
    ];

    // Chọn Thu/Chi thì kèm Dự thu/Dự chi tương ứng để người xem thấy cả hai nhóm
    const expandedColumns =
      selectedColumns && selectedColumns.length > 0
        ? [
            ...selectedColumns,
            ...(selectedColumns.includes('thu') ? ['duThu'] : []),
            ...(selectedColumns.includes('chi') ? ['duChi'] : []),
          ]
        : undefined;
    const columns = expandedColumns
      ? allColumns.filter((c) => expandedColumns.includes(c.key))
      : allColumns;

    worksheet.columns = columns.map((c) => ({ key: c.key, width: c.width }));

    // Reserved rows: 1 = SUM, 2 = SUBTOTAL, 3 = Empty, 4 = Headers, 5+ = Data
    worksheet.addRow({}); // Row 1
    worksheet.addRow({}); // Row 2
    worksheet.addRow({}); // Row 3
    worksheet.addRow({}); // Row 4 (headers)

    const borderThin = {
      top: { style: 'thin' as const, color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'thin' as const, color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin' as const, color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin' as const, color: { argb: 'FFCBD5E1' } },
    };

    const sums: Record<string, number> = {
      thu: 0,
      duThu: 0,
      chi: 0,
      duChi: 0,
    };

    vouchers.forEach((item, index) => {
      const amount = Number(item.amount) || 0;
      // Nhóm dòng tiền theo sổ quỹ (cùng quy tắc báo cáo kỳ); phiếu đã hủy không vào cột tiền nào
      const category = classifyVoucher({
        voucherType: item.voucherType,
        paymentStatus: item.paymentStatus,
      });
      const amountOf = (target: string) => (category === target ? amount : 0);
      const thu = amountOf('ACTUAL_IN');
      const duThu = amountOf('EXPECTED_IN');
      const chi = amountOf('ACTUAL_OUT');
      const duChi = amountOf('PLANNED_OUT');

      sums.thu += thu;
      sums.duThu += duThu;
      sums.chi += chi;
      sums.duChi += duChi;

      let paymentStatusText = 'Đã hủy';
      if (category === 'ACTUAL_IN') paymentStatusText = 'Đã thu';
      else if (category === 'EXPECTED_IN') paymentStatusText = 'Dự thu';
      else if (category === 'ACTUAL_OUT') paymentStatusText = 'Đã chi';
      else if (category === 'PLANNED_OUT')
        paymentStatusText =
          item.paymentStatus === 'APPROVED'
            ? 'Dự chi (Đã duyệt)'
            : 'Dự chi (Chờ duyệt)';

      const transDateVal = toVietnamExcelDate(item.transDate);
      const createdAtVal = toVietnamExcelDate(item.createdAt);
      const updatedAtVal = toVietnamExcelDate(item.updatedAt);

      const row = worksheet.addRow({
        stt: index + 1,
        transDate: transDateVal ?? item.transDate,
        voucherCode: item.voucherCode,
        thu: thu || null,
        duThu: duThu || null,
        chi: chi || null,
        duChi: duChi || null,
        paymentStatus: paymentStatusText,
        paymentMethod: item.paymentMethod || '',
        paymentContent: item.paymentContent || '',
        caseCode: item.case?.soChungTu || '',
        licensePlate: item.licensePlate || item.case?.bienSoXe || '',
        partnerName: item.partnerName || item.case?.khachHangName || '',
        note: item.note || '',
        createdBy: item.createdBy || '',
        createdAt: createdAtVal ?? item.createdAt,
        updatedBy: (item as any).updatedBy || (item as any).updated_by || '',
        updatedAt: updatedAtVal ?? item.updatedAt,
      });

      row.height = 20;

      columns.forEach((col) => {
        const cell = row.getCell(col.key);
        cell.border = borderThin;
        const align = GarageCashflowExcelBuilder.ALIGNMENTS[col.key] || {
          horizontal: 'left',
          vertical: 'middle',
        };
        cell.alignment = align;
        if (col.style?.numFmt) {
          cell.numFmt = col.style.numFmt;
        }
      });
    });

    onProgress?.(85, 'Đang định dạng công thức và header...');

    this.applySummaryAndHeaders(worksheet, columns, sums, borderThin);
    // Cột dự kiến tô nền khác cột thực tế; cột có thể không được chọn nên tính theo danh sách hiện tại
    for (const key of ['duThu', 'duChi']) {
      const idx = columns.findIndex((c) => c.key === key);
      if (idx >= 0) applyForecastColumnStyle(worksheet, idx + 1);
    }

    onProgress?.(95, 'Đang nén file Excel...');
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.isBuffer(buffer)
      ? buffer
      : Buffer.from(buffer as ArrayBuffer);
  }

  private applySummaryAndHeaders(
    worksheet: any,
    columns: CashflowColumnDefinition[],
    calculatedSums: Record<string, number>,
    borderThin: any,
  ) {
    const totalCols = columns.length;
    const startRow = 5;
    const endRow = Math.max(startRow, worksheet.rowCount);

    const sumRow = worksheet.getRow(1);
    sumRow.height = 22;
    sumRow.font = {
      name: 'Calibri',
      size: 10.5,
      bold: true,
      color: { argb: 'FF78350F' }, // Amber 900
    };

    const subtotalRow = worksheet.getRow(2);
    subtotalRow.height = 22;
    subtotalRow.font = {
      name: 'Calibri',
      size: 10.5,
      bold: true,
      color: { argb: 'FF0F172A' }, // Slate 900
    };

    worksheet.getRow(3).height = 10;

    const headerRow = worksheet.getRow(4);
    headerRow.height = 28;
    headerRow.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true,
    };

    const firstSumColIdx = columns.findIndex((c) => c.isSum);
    const labelCol = Math.max(1, firstSumColIdx >= 0 ? firstSumColIdx : 1);

    for (let c = 1; c <= totalCols; c++) {
      const colDef = columns[c - 1];
      const colLetter = this.getColLetter(c);

      const cellSum = sumRow.getCell(c);
      cellSum.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFFBEB' }, // Amber 50
      };
      cellSum.border = borderThin;

      const cellSub = subtotalRow.getCell(c);
      cellSub.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF8FAFC' }, // Slate 50
      };
      cellSub.border = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'double', color: { argb: 'FF0F172A' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };

      const cellHdr = headerRow.getCell(c);
      cellHdr.value = colDef.header;
      cellHdr.font = {
        name: 'Calibri',
        size: 11,
        bold: true,
        color: { argb: 'FFFFFFFF' },
      };
      cellHdr.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF334155' }, // Slate 700
      };
      cellHdr.border = borderThin;

      if (c === labelCol) {
        cellSum.value = 'TỔNG CỘNG (SUM)';
        cellSum.alignment = { horizontal: 'left', vertical: 'middle' };
        cellSub.value = 'TỔNG THEO BỘ LỌC (SUBTOTAL)';
        cellSub.alignment = { horizontal: 'left', vertical: 'middle' };
      }

      if (colDef.isSum) {
        const sumVal = calculatedSums[colDef.key] || 0;
        cellSum.value = {
          formula: `SUM(${colLetter}${startRow}:${colLetter}${endRow})`,
          result: sumVal,
        };
        cellSum.alignment = { horizontal: 'right', vertical: 'middle' };
        cellSum.numFmt = colDef.style?.numFmt || '#,##0';

        cellSub.value = {
          formula: `SUBTOTAL(9,${colLetter}${startRow}:${colLetter}${endRow})`,
          result: sumVal,
        };
        cellSub.alignment = { horizontal: 'right', vertical: 'middle' };
        cellSub.numFmt = colDef.style?.numFmt || '#,##0';
      }
    }

    worksheet.views = [{ state: 'frozen', ySplit: 4 }];
    worksheet.autoFilter = {
      from: { row: 4, column: 1 },
      to: { row: endRow, column: totalCols },
    };
  }

  private getColLetter(colIndex: number): string {
    let letter = '';
    let temp = colIndex;
    while (temp > 0) {
      const mod = (temp - 1) % 26;
      letter = String.fromCharCode(65 + mod) + letter;
      temp = Math.floor((temp - mod) / 26);
    }
    return letter;
  }
}
