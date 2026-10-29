import { Injectable } from '@nestjs/common';
import { Row, Workbook, Worksheet } from 'exceljs';
import { ErpBankTransaction } from '../entities/erp_bank_transaction.entity';
import { toVietnamExcelDate } from '../../common/utils/date.util';
import {
  CASHFLOW_CLASSIFICATION_EXPORT_LABELS,
  CASHFLOW_PURPOSE_EXPORT_LABELS,
  toCashflowExportLabel,
} from '../constants/cashflow-labels';
import { buildUniqueSheetName } from '../utils/sheet-name.util';
import {
  AQUA_KEYS,
  ALIGNMENTS,
  BORDER_THIN,
  COLOR,
  DATA_START_ROW,
  ExportColumn,
  HEADER_ROW,
  INVOICE_KEYS,
  MONEY_FMT,
  buildExportColumns,
  solidFill,
} from './bank-statement-excel.layout';

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
  selectedColumns?: string[];
  onProgress?: (percent: number, message: string) => void;
}

interface AccountGroup {
  label: string;
  items: ErpBankTransaction[];
}

type SheetEntry = { item: ErpBankTransaction; invList: NetOffInvoiceItem[] };

const NO_ACCOUNT_KEY = '__none__';
const NO_ACCOUNT_LABEL = 'Khác';
const DEFAULT_SHEET_NAME: Record<'BANK' | 'CASH', string> = {
  BANK: 'Sao kê Ngân hàng',
  CASH: 'Sổ quỹ Tiền mặt',
};

@Injectable()
export class BankStatementExcelBuilder {
  async build(options: BankStatementExcelBuildOptions): Promise<Buffer> {
    const {
      sourceType,
      transactions,
      netOffDetails,
      selectedColumns,
      onProgress,
    } = options;
    onProgress?.(65, 'Đang tạo cấu trúc bảng tính Excel...');

    const workbook = new Workbook();
    const columns = buildExportColumns(sourceType, selectedColumns);

    // Group net-off invoices by bank transaction ID
    const netOffMap = new Map<string, NetOffInvoiceItem[]>();
    for (const item of netOffDetails) {
      const list = netOffMap.get(item.bankTransactionId) || [];
      list.push(item);
      netOffMap.set(item.bankTransactionId, list);
    }

    const groups = this.groupByAccount(transactions, sourceType);
    const usedNames = new Set<string>();

    if (groups.length === 0) {
      this.writeSheet(
        workbook,
        buildUniqueSheetName(
          DEFAULT_SHEET_NAME[sourceType ?? 'BANK'],
          usedNames,
        ),
        [],
        columns,
        sourceType,
      );
    }

    for (const group of groups) {
      const entries: SheetEntry[] = group.items.map((item) => ({
        item,
        invList: netOffMap.get(item.id) || [],
      }));
      this.writeSheet(
        workbook,
        buildUniqueSheetName(group.label, usedNames),
        entries,
        columns,
        sourceType,
      );
    }

    onProgress?.(85, 'Đang tổng hợp dữ liệu và hoàn tất file...');

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.isBuffer(buffer)
      ? buffer
      : Buffer.from(buffer as ArrayBuffer);
  }

  /** Nhóm giao dịch theo tài khoản (BANK) hoặc sổ quỹ (CASH), giữ thứ tự xuất hiện. */
  private groupByAccount(
    transactions: ErpBankTransaction[],
    sourceType?: 'BANK' | 'CASH',
  ): AccountGroup[] {
    const groups = new Map<string, AccountGroup>();
    for (const item of transactions) {
      const key =
        sourceType === 'CASH'
          ? (item.cashBookId ?? item.cashBook?.id ?? NO_ACCOUNT_KEY)
          : (item.bankAccountId ?? item.bankAccount?.id ?? NO_ACCOUNT_KEY);
      let group = groups.get(key);
      if (!group) {
        group = {
          label: this.accountText(item, sourceType) || NO_ACCOUNT_LABEL,
          items: [],
        };
        groups.set(key, group);
      }
      group.items.push(item);
    }
    return [...groups.values()];
  }

  private writeSheet(
    workbook: Workbook,
    name: string,
    entries: SheetEntry[],
    columns: ExportColumn[],
    sourceType?: 'BANK' | 'CASH',
  ) {
    const worksheet = workbook.addWorksheet(name);
    worksheet.columns = columns.map((c) => ({ key: c.key, width: c.width }));

    // Rows 1-2: TỔNG / SUBTOTAL, row 3: spacer, row 4: header
    for (let r = 1; r < DATA_START_ROW; r++) worksheet.addRow([]);

    const rowValues = entries.map(({ item, invList }, index) =>
      this.buildRowValues(item, index + 1, invList, sourceType),
    );
    rowValues.forEach((values) => {
      const row = worksheet.addRow(values);
      this.styleDataRow(row, columns);
    });

    const dataEnd = DATA_START_ROW + entries.length - 1;
    const sums = this.sumColumns(columns, rowValues);
    this.applySummaryAndHeaders(worksheet, columns, sums, dataEnd);
  }

  private buildRowValues(
    item: ErpBankTransaction,
    stt: number,
    invList: NetOffInvoiceItem[],
    sourceType?: 'BANK' | 'CASH',
  ): Record<string, unknown> {
    const credit = parseFloat(item.creditAmount as any) || 0;
    const debit = parseFloat(item.debitAmount as any) || 0;
    const netOff = invList.reduce(
      (sum, curr) => sum + (Number(curr.netOffAmount) || 0),
      0,
    );
    const remaining = Math.max(0, Math.max(credit, debit) - netOff);
    const invoice = this.buildInvoiceValues(invList);

    return {
      stt,
      account: this.accountText(item, sourceType),
      transDate: toVietnamExcelDate(item.transDate) ?? '',
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
      cashflowClassification: toCashflowExportLabel(
        CASHFLOW_CLASSIFICATION_EXPORT_LABELS,
        item.cashflowClassification,
      ),
      cashflowPurpose: toCashflowExportLabel(
        CASHFLOW_PURPOSE_EXPORT_LABELS,
        item.cashflowPurpose,
      ),
      note: item.note || '',
      businessPartner: item.partner?.name || '',
      branchName:
        (item as { branchNames?: string }).branchNames ??
        item.branch?.name ??
        '',
      ...invoice,
    };
  }

  private buildInvoiceValues(invList: NetOffInvoiceItem[]) {
    const invTotal = invList.length
      ? invList.reduce((sum, curr) => sum + (Number(curr.totalAmount) || 0), 0)
      : '';
    return {
      invoiceBranchName: Array.from(
        new Set(invList.map((i) => i.invoiceBranchName).filter(Boolean)),
      ).join(', '),
      invoiceDate: invList
        .map((i) => this.formatDateString(i.invoiceDate))
        .filter(Boolean)
        .join(', '),
      invoiceNo: invList
        .map((i) => i.invoiceNo)
        .filter(Boolean)
        .join(', '),
      invoiceSerial: Array.from(
        new Set(invList.map((i) => i.serialNo).filter(Boolean)),
      ).join(', '),
      invoicePartner: Array.from(
        new Set(invList.map((i) => this.formatPartnerInfo(i)).filter(Boolean)),
      ).join('; '),
      invoiceDescription: invList
        .map((i) => i.invoiceDescription)
        .filter(Boolean)
        .join('; '),
      invoiceTotalAmount: invTotal,
    };
  }

  private styleDataRow(row: Row, columns: ExportColumn[]) {
    row.height = 20;
    row.font = { name: 'Calibri', size: 10 };

    columns.forEach((colDef, idx) => {
      const cell = row.getCell(idx + 1);
      const isInvoiceCol = INVOICE_KEYS.has(colDef.key);
      const isFirstInvCol =
        isInvoiceCol && (idx === 0 || !INVOICE_KEYS.has(columns[idx - 1].key));

      cell.alignment = ALIGNMENTS[colDef.key] || {
        horizontal: 'left',
        vertical: 'middle',
      };
      if (colDef.style?.numFmt) cell.numFmt = colDef.style.numFmt;

      if (AQUA_KEYS.has(colDef.key)) {
        cell.fill = solidFill(COLOR.aquaFill);
      } else if (isInvoiceCol) {
        cell.fill = solidFill(COLOR.invoiceFill);
      }

      cell.border = isFirstInvCol
        ? {
            ...BORDER_THIN,
            left: { style: 'double', color: { argb: COLOR.invoiceHeader } },
          }
        : BORDER_THIN;
    });
  }

  private sumColumns(
    columns: ExportColumn[],
    rows: Record<string, unknown>[],
  ): Record<string, number> {
    const sums: Record<string, number> = {};
    for (const col of columns.filter((c) => c.isSum)) {
      sums[col.key] = rows.reduce(
        (acc, row) => acc + (Number(row[col.key]) || 0),
        0,
      );
    }
    return sums;
  }

  private applySummaryAndHeaders(
    worksheet: Worksheet,
    columns: ExportColumn[],
    sums: Record<string, number>,
    dataEnd: number,
  ) {
    const hasRows = dataEnd >= DATA_START_ROW;
    const totalRow = worksheet.getRow(1);
    const subtotalRow = worksheet.getRow(2);
    totalRow.height = 20;
    subtotalRow.height = 20;
    worksheet.getRow(3).height = 10;

    const headerRow = worksheet.getRow(HEADER_ROW);
    headerRow.height = 28;
    headerRow.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true,
    };

    columns.forEach((colDef, idx) => {
      const c = idx + 1;
      const letter = this.getColLetter(c);
      const isInvoiceCol = INVOICE_KEYS.has(colDef.key);
      const isAqua = AQUA_KEYS.has(colDef.key);
      const isFirstInvCol =
        isInvoiceCol && (c === 1 || !INVOICE_KEYS.has(columns[c - 2].key));

      const totalCell = totalRow.getCell(c);
      totalCell.fill = solidFill(COLOR.totalFill);
      totalCell.border = BORDER_THIN;
      totalCell.font = {
        name: 'Calibri',
        size: 10,
        bold: true,
        color: { argb: COLOR.totalFont },
      };

      const subCell = subtotalRow.getCell(c);
      subCell.fill = solidFill(COLOR.subtotalFill);
      subCell.border = BORDER_THIN;
      subCell.font = {
        name: 'Calibri',
        size: 10,
        italic: true,
        color: { argb: COLOR.subtotalFont },
      };

      const headerCell = headerRow.getCell(c);
      headerCell.value = colDef.header;
      headerCell.font = isAqua
        ? {
            name: 'Calibri',
            size: 11,
            bold: true,
            color: { argb: COLOR.darkText },
          }
        : {
            name: 'Calibri',
            size: 11,
            bold: true,
            color: { argb: COLOR.white },
          };
      headerCell.fill = solidFill(
        isAqua
          ? COLOR.aquaFill
          : isInvoiceCol
            ? COLOR.invoiceHeader
            : COLOR.bankHeader,
      );
      headerCell.border = isFirstInvCol
        ? {
            ...BORDER_THIN,
            left: { style: 'double', color: { argb: COLOR.invoiceHeader } },
          }
        : BORDER_THIN;

      if (c === 1) {
        totalCell.value = 'TỔNG';
        subCell.value = 'SUBTOTAL (theo bộ lọc)';
      }

      if (colDef.isSum) {
        const range = `${letter}${DATA_START_ROW}:${letter}${dataEnd}`;
        const sumVal = sums[colDef.key] ?? 0;
        const numFmt = colDef.style?.numFmt ?? MONEY_FMT;

        totalCell.value = hasRows
          ? { formula: `SUM(${range})`, result: sumVal }
          : 0;
        subCell.value = hasRows
          ? { formula: `SUBTOTAL(9,${range})`, result: sumVal }
          : 0;
        totalCell.numFmt = numFmt;
        subCell.numFmt = numFmt;
        totalCell.alignment = { horizontal: 'right', vertical: 'middle' };
        subCell.alignment = { horizontal: 'right', vertical: 'middle' };
      }
    });

    worksheet.views = [{ state: 'frozen', ySplit: HEADER_ROW }];
    if (hasRows) {
      worksheet.autoFilter = {
        from: { row: HEADER_ROW, column: 1 },
        to: { row: dataEnd, column: columns.length },
      };
    }
  }

  private accountText(
    item: ErpBankTransaction,
    sourceType?: 'BANK' | 'CASH',
  ): string {
    if (sourceType === 'CASH') return item.cashBook?.name || '';
    return item.bankAccount
      ? `${item.bankAccount.bankCode} - ${item.bankAccount.accountNumber}`
      : '';
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
