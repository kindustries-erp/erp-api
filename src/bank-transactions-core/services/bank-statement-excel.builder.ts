import { Injectable } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { ErpBankTransaction } from '../entities/erp_bank_transaction.entity';
import { toVietnamExcelDate } from '../../common/utils/date.util';

export interface NetOffInvoiceItem {
  bankTransactionId: string;
  netOffAmount: number;
  invoiceId: string;
  invoiceNo: string;
  serialNo?: string;
  invoiceDate?: string;
  invoiceDescription?: string;
  direction?: string;
  sellerName?: string;
  sellerTaxCode?: string;
  buyerName?: string;
  buyerTaxCode?: string;
  totalAmount?: number | string;
  invoiceBranchName?: string;
}

export interface BankStatementExcelBuildOptions {
  sourceType?: 'BANK' | 'CASH';
  transactions: ErpBankTransaction[];
  netOffDetails: NetOffInvoiceItem[];
  onProgress?: (percent: number, message: string) => void;
}

@Injectable()
export class BankStatementExcelBuilder {
  private static readonly INVOICE_START_COL = 15;

  async build(options: BankStatementExcelBuildOptions): Promise<Buffer> {
    const { sourceType, transactions, netOffDetails, onProgress } = options;
    onProgress?.(65, 'Đang tạo cấu trúc bảng tính Excel...');

    const workbook = new Workbook();
    const sheetName =
      sourceType === 'CASH' ? 'Sổ quỹ Tiền mặt' : 'Sao kê Ngân hàng';
    const worksheet = workbook.addWorksheet(sheetName);

    // Group net-off invoices by bank transaction ID
    const netOffMap = new Map<string, NetOffInvoiceItem[]>();
    for (const item of netOffDetails) {
      const list = netOffMap.get(item.bankTransactionId) || [];
      list.push(item);
      netOffMap.set(item.bankTransactionId, list);
    }

    const columns: Array<{
      header: string;
      key: string;
      width: number;
      style?: { numFmt?: string };
      isSum?: boolean;
    }> = [
      { header: 'STT', key: 'stt', width: 8 },
      {
        header: sourceType === 'CASH' ? 'Sổ quỹ' : 'Ngân hàng',
        key: 'account',
        width: 25,
      },
      {
        header: 'Ngày GD',
        key: 'transDate',
        width: 22,
        style: { numFmt: 'dd/mm/yyyy hh:mm:ss' },
      },
      { header: 'Số tham chiếu', key: 'referenceNumber', width: 24 },
      { header: 'Diễn giải', key: 'description', width: 45 },
      {
        header: 'Thu (VND)',
        key: 'credit',
        width: 18,
        style: { numFmt: '#,##0.00' },
        isSum: true,
      },
      {
        header: 'Chi (VND)',
        key: 'debit',
        width: 18,
        style: { numFmt: '#,##0.00' },
        isSum: true,
      },
      {
        header: 'Số dư (VND)',
        key: 'balance',
        width: 18,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Đã cấn trừ (VND)',
        key: 'netOffAmount',
        width: 18,
        style: { numFmt: '#,##0.00' },
        isSum: true,
      },
      {
        header: 'Còn lại (VND)',
        key: 'remainingAmount',
        width: 18,
        style: { numFmt: '#,##0.00' },
        isSum: true,
      },
      { header: 'TK đối ứng', key: 'correspondentAccount', width: 18 },
      { header: 'Tên đối tác', key: 'correspondentName', width: 30 },
      { header: 'Ngân hàng đối tác', key: 'correspondentBank', width: 22 },
      { header: 'Chi nhánh GD', key: 'branchName', width: 22 },
      // Nhóm cột Hóa đơn cấn trừ (Cột 15-21)
      { header: '[HĐ] Chi nhánh', key: 'invoiceBranchName', width: 24 },
      {
        header: '[HĐ] Ngày HĐ',
        key: 'invoiceDate',
        width: 20,
        style: { numFmt: 'dd/mm/yyyy' },
      },
      { header: '[HĐ] Số HĐ', key: 'invoiceNo', width: 20 },
      { header: '[HĐ] Ký hiệu HĐ', key: 'invoiceSerial', width: 18 },
      { header: '[HĐ] Đối tác HĐ', key: 'invoicePartner', width: 38 },
      { header: '[HĐ] Nội dung HĐ', key: 'invoiceDescription', width: 45 },
      {
        header: '[HĐ] Tổng tiền HĐ (VND)',
        key: 'invoiceTotalAmount',
        width: 22,
        style: { numFmt: '#,##0.00' },
      },
    ];

    worksheet.columns = columns.map((c) => ({ key: c.key, width: c.width }));
    worksheet.addRow([]);
    worksheet.addRow([]);
    worksheet.addRow([]);
    worksheet.addRow([]);

    const borderThin = {
      top: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
    };

    const invoiceFill = {
      type: 'pattern' as const,
      pattern: 'solid' as const,
      fgColor: { argb: 'FFF0FDF4' }, // Emerald 50 pastel
    };

    let totalCredit = 0;
    let totalDebit = 0;
    let totalNetOff = 0;
    let totalRemaining = 0;

    transactions.forEach((item, index) => {
      const credit = parseFloat(item.creditAmount as any) || 0;
      const debit = parseFloat(item.debitAmount as any) || 0;
      const invList = netOffMap.get(item.id) || [];
      const netOff = invList.reduce(
        (sum, curr) => sum + (Number(curr.netOffAmount) || 0),
        0,
      );
      const remaining = Math.max(0, Math.max(credit, debit) - netOff);

      totalCredit += credit;
      totalDebit += debit;
      totalNetOff += netOff;
      totalRemaining += remaining;

      const accountText =
        sourceType === 'CASH'
          ? item.cashBook?.name || ''
          : item.bankAccount
            ? `${item.bankAccount.bankCode} - ${item.bankAccount.accountNumber}`
            : '';

      const transDateVal = toVietnamExcelDate(item.transDate);

      // Aggregate invoice net-off fields
      const invBranchNames = Array.from(
        new Set(invList.map((i) => i.invoiceBranchName).filter(Boolean)),
      ).join(', ');
      const invNos = invList
        .map((i) => i.invoiceNo)
        .filter(Boolean)
        .join(', ');
      const invSerials = Array.from(
        new Set(invList.map((i) => i.serialNo).filter(Boolean)),
      ).join(', ');
      const invDates = invList
        .map((i) => this.formatDateString(i.invoiceDate))
        .filter(Boolean)
        .join(', ');
      const invPartners = Array.from(
        new Set(invList.map((i) => this.formatPartnerInfo(i)).filter(Boolean)),
      ).join('; ');
      const invDescriptions = invList
        .map((i) => i.invoiceDescription)
        .filter(Boolean)
        .join('; ');
      const invTotalAmount = invList.length
        ? invList.reduce(
            (sum, curr) => sum + (Number(curr.totalAmount) || 0),
            0,
          )
        : null;

      const row = worksheet.addRow({
        stt: index + 1,
        account: accountText,
        transDate: transDateVal ?? '',
        referenceNumber: item.referenceNumber || '',
        description: item.description || '',
        credit,
        debit,
        balance: parseFloat(item.balance as any) || 0,
        netOffAmount: netOff,
        remainingAmount: remaining,
        correspondentAccount: item.correspondentAccount || '',
        correspondentName: item.correspondentName || '',
        correspondentBank: item.correspondentBank || '',
        branchName: item.branch?.name || '',
        invoiceBranchName: invBranchNames,
        invoiceDate: invDates,
        invoiceNo: invNos,
        invoiceSerial: invSerials,
        invoicePartner: invPartners,
        invoiceDescription: invDescriptions,
        invoiceTotalAmount: invTotalAmount ?? '',
      });

      row.height = 20;
      row.font = { name: 'Calibri', size: 10 };

      // Base Bank Statement Alignments & Formats
      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
      if (transDateVal) row.getCell(3).numFmt = 'dd/mm/yyyy hh:mm:ss';
      row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(5).alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(6).numFmt = '#,##0.00';
      row.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(7).numFmt = '#,##0.00';
      row.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(8).numFmt = '#,##0.00';
      row.getCell(9).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(9).numFmt = '#,##0.00';
      row.getCell(10).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(10).numFmt = '#,##0.00';
      row.getCell(11).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(12).alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell(13).alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell(14).alignment = { horizontal: 'center', vertical: 'middle' };

      // Invoice Net-Off Alignments & Formats (Cols 15-21)
      row.getCell(15).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(16).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(17).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(18).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(19).alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell(20).alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell(21).alignment = { horizontal: 'right', vertical: 'middle' };
      if (invTotalAmount !== null) row.getCell(21).numFmt = '#,##0.00';

      // Apply 2-tone borders & fill
      for (let c = 1; c <= columns.length; c++) {
        const cell = row.getCell(c);
        if (c >= BankStatementExcelBuilder.INVOICE_START_COL) {
          cell.fill = invoiceFill;
          cell.border =
            c === BankStatementExcelBuilder.INVOICE_START_COL
              ? {
                  ...borderThin,
                  left: {
                    style: 'double' as const,
                    color: { argb: 'FF065F46' },
                  },
                }
              : borderThin;
        } else {
          cell.border = borderThin;
        }
      }
    });

    onProgress?.(85, 'Đang tổng hợp dữ liệu và hoàn tất file...');

    this.applySummaryAndHeaders(
      worksheet,
      columns,
      totalCredit,
      totalDebit,
      totalNetOff,
      totalRemaining,
      borderThin,
      invoiceFill,
    );

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.isBuffer(buffer)
      ? buffer
      : Buffer.from(buffer as ArrayBuffer);
  }

  private applySummaryAndHeaders(
    worksheet: any,
    columns: any[],
    totalCredit: number,
    totalDebit: number,
    totalNetOff: number,
    totalRemaining: number,
    borderThin: any,
    invoiceFill: any,
  ) {
    const totalCols = columns.length;
    const startRow = 5;
    const endRow = Math.max(startRow, worksheet.rowCount);
    const calculatedSums: Record<string, number> = {
      credit: totalCredit,
      debit: totalDebit,
      netOffAmount: totalNetOff,
      remainingAmount: totalRemaining,
    };

    const sumRow = worksheet.getRow(1);
    sumRow.height = 22;
    sumRow.font = {
      name: 'Calibri',
      size: 10.5,
      bold: true,
      color: { argb: 'FF0F172A' },
    };

    const subtotalRow = worksheet.getRow(2);
    subtotalRow.height = 22;
    subtotalRow.font = {
      name: 'Calibri',
      size: 10.5,
      bold: true,
      color: { argb: 'FF1E40AF' },
    };

    worksheet.getRow(3).height = 10;

    const headerRow = worksheet.getRow(4);
    headerRow.height = 28;
    headerRow.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true,
    };

    for (let c = 1; c <= totalCols; c++) {
      const colDef = columns[c - 1];
      const colLetter = this.getColLetter(c);
      const isInvoiceCol = c >= BankStatementExcelBuilder.INVOICE_START_COL;

      const cellSum = sumRow.getCell(c);
      cellSum.fill = isInvoiceCol
        ? invoiceFill
        : {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF1F5F9' },
          };
      cellSum.border = borderThin;

      const cellSub = subtotalRow.getCell(c);
      cellSub.fill = isInvoiceCol
        ? invoiceFill
        : {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFEFF6FF' },
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
        fgColor: {
          argb: isInvoiceCol ? 'FF065F46' : 'FF334155', // Emerald 800 vs Slate 700
        },
      };
      cellHdr.border =
        c === BankStatementExcelBuilder.INVOICE_START_COL
          ? {
              ...borderThin,
              left: { style: 'double', color: { argb: 'FF065F46' } },
            }
          : borderThin;

      if (c === 5) {
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
        cellSum.numFmt = colDef.style?.numFmt || '#,##0.00';

        cellSub.value = {
          formula: `SUBTOTAL(9,${colLetter}${startRow}:${colLetter}${endRow})`,
          result: sumVal,
        };
        cellSub.alignment = { horizontal: 'right', vertical: 'middle' };
        cellSub.numFmt = colDef.style?.numFmt || '#,##0.00';
      }
    }

    worksheet.views = [{ state: 'frozen', ySplit: 4 }];
    worksheet.autoFilter = {
      from: { row: 4, column: 1 },
      to: { row: endRow, column: totalCols },
    };
  }

  private formatDateString(dateInput?: string): string {
    if (!dateInput) return '';
    try {
      const d = new Date(dateInput);
      if (isNaN(d.getTime())) return dateInput;
      const day = String(d.getUTCDate()).padStart(2, '0');
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const year = d.getUTCFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return dateInput;
    }
  }

  private formatPartnerInfo(item: NetOffInvoiceItem): string {
    const isOut = item.direction === 'OUT';
    const name = (isOut ? item.buyerName : item.sellerName) || '';
    const taxCode = (isOut ? item.buyerTaxCode : item.sellerTaxCode) || '';
    if (name && taxCode) return `${name} (MST: ${taxCode})`;
    return name || taxCode || '';
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
