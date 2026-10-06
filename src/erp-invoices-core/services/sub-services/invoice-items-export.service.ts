import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import {
  ErpInvoiceItemQuery,
  InvoiceItemsQueryService,
} from './invoice-items-query.service';
import { getExcelColumnLetter } from './invoice-query-helpers';
import {
  borderThin,
  formatTaxInvoiceStatus,
} from './invoice-export-excel-writers.helper';
import { formatVatRate } from '../../helpers/invoice-mapper.helper';

@Injectable()
export class InvoiceItemsExportService {
  constructor(private readonly itemsQueryService: InvoiceItemsQueryService) {}

  async exportItemsExcel(query: ErpInvoiceItemQuery): Promise<Buffer> {
    const result = await this.itemsQueryService.findAllItems({
      ...query,
      page: 1,
      pageSize: 100000,
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Liouni ERP';
    workbook.lastModifiedBy = 'Liouni ERP';
    workbook.created = new Date();

    const sheetName =
      query.direction === 'OUT' ? 'Dòng HĐ Đầu Ra' : 'Dòng HĐ Đầu Vào';
    const worksheet = workbook.addWorksheet(sheetName, {
      views: [{ showGridLines: true }],
    });

    const columns = [
      { header: 'STT', key: 'stt', width: 8 },
      { header: 'Số HĐ', key: 'invoiceNo', width: 16 },
      { header: 'Ký hiệu', key: 'serialNo', width: 14 },
      { header: 'Ngày HĐ', key: 'invoiceDate', width: 14 },
      {
        header: query.direction === 'OUT' ? 'Người mua' : 'Người bán',
        key: 'partnerName',
        width: 32,
      },
      { header: 'Mã số thuế', key: 'taxCode', width: 16 },
      { header: 'Mã hàng', key: 'itemCode', width: 16 },
      {
        header: 'Diễn giải / Tên hàng hóa, dịch vụ',
        key: 'description',
        width: 40,
      },
      { header: 'ĐVT', key: 'unit', width: 10 },
      {
        header: 'Số lượng',
        key: 'quantity',
        width: 12,
        style: { numFmt: '#,##0.00' },
        isSum: true,
      },
      {
        header: 'Đơn giá',
        key: 'unitPrice',
        width: 16,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Thành tiền',
        key: 'preVatAmount',
        width: 18,
        style: { numFmt: '#,##0.00' },
        isSum: true,
      },
      { header: 'Thuế suất', key: 'vatRate', width: 12 },
      {
        header: 'Tiền thuế VAT',
        key: 'vatAmount',
        width: 16,
        style: { numFmt: '#,##0.00' },
        isSum: true,
      },
      {
        header: 'Chiết khấu',
        key: 'discountAmount',
        width: 16,
        style: { numFmt: '#,##0.00' },
        isSum: true,
      },
      {
        header: 'Tổng thanh toán',
        key: 'totalAmount',
        width: 20,
        style: { numFmt: '#,##0.00' },
        isSum: true,
      },
      { header: 'Chi nhánh', key: 'branchName', width: 22 },
      { header: 'Trạng thái GĐT', key: 'taxInvoiceStatus', width: 16 },
    ];

    worksheet.columns = columns.map((c) => ({
      key: c.key,
      width: c.width,
    }));
    worksheet.addRow([]);
    worksheet.addRow([]);
    worksheet.addRow([]);
    worksheet.addRow([]);

    result.items.forEach((item, index) => {
      const row = worksheet.addRow({
        stt: index + 1,
        invoiceNo: item.invoiceNo || '',
        serialNo: item.serialNo || '',
        invoiceDate: item.invoiceDate || '',
        partnerName:
          query.direction === 'OUT'
            ? item.buyerName || item.buyerPersonalName || ''
            : item.sellerName || '',
        taxCode:
          query.direction === 'OUT'
            ? item.buyerTaxCode || item.buyerCccd || ''
            : item.sellerTaxCode || '',
        itemCode: item.itemCode || '',
        description: item.description || '',
        unit: item.unit || '',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        preVatAmount: item.preVatAmount,
        vatRate: formatVatRate(item.vatRate),
        vatAmount: item.vatAmount,
        discountAmount: item.discountAmount,
        totalAmount: item.totalAmount,
        branchName: item.branchName || '',
        taxInvoiceStatus: formatTaxInvoiceStatus(item.taxInvoiceStatus),
      });

      row.height = 20;
      row.font = { name: 'Calibri', size: 10 };

      row.getCell('stt').alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      row.getCell('invoiceNo').alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      row.getCell('serialNo').alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      row.getCell('invoiceDate').alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      row.getCell('partnerName').alignment = {
        horizontal: 'left',
        vertical: 'middle',
      };
      row.getCell('taxCode').alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      row.getCell('itemCode').alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      row.getCell('description').alignment = {
        horizontal: 'left',
        vertical: 'middle',
      };
      row.getCell('unit').alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      row.getCell('quantity').alignment = {
        horizontal: 'right',
        vertical: 'middle',
      };
      row.getCell('quantity').numFmt = '#,##0.00';
      row.getCell('unitPrice').alignment = {
        horizontal: 'right',
        vertical: 'middle',
      };
      row.getCell('unitPrice').numFmt = '#,##0.00';
      row.getCell('preVatAmount').alignment = {
        horizontal: 'right',
        vertical: 'middle',
      };
      row.getCell('preVatAmount').numFmt = '#,##0.00';
      row.getCell('vatRate').alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      row.getCell('vatAmount').alignment = {
        horizontal: 'right',
        vertical: 'middle',
      };
      row.getCell('vatAmount').numFmt = '#,##0.00';
      row.getCell('discountAmount').alignment = {
        horizontal: 'right',
        vertical: 'middle',
      };
      row.getCell('discountAmount').numFmt = '#,##0.00';
      row.getCell('totalAmount').alignment = {
        horizontal: 'right',
        vertical: 'middle',
      };
      row.getCell('totalAmount').numFmt = '#,##0.00';
      row.getCell('branchName').alignment = {
        horizontal: 'left',
        vertical: 'middle',
      };
      row.getCell('taxInvoiceStatus').alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };

      for (let c = 1; c <= 18; c++) {
        row.getCell(c).border = borderThin;
      }
    });

    const totalCols = columns.length;
    const startRow = 5;
    const endRow = Math.max(startRow, worksheet.rowCount);
    const calculatedSums: Record<string, number> = {
      quantity: result.summary.totalQuantity,
      preVatAmount: result.summary.totalPreVatAmount,
      vatAmount: result.summary.totalVatAmount,
      discountAmount: result.summary.totalDiscountAmount,
      totalAmount: result.summary.totalAmount,
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

    const blankRow = worksheet.getRow(3);
    blankRow.height = 10;

    const headerRow = worksheet.getRow(4);
    headerRow.height = 28;
    headerRow.font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    headerRow.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true,
    };

    for (let c = 1; c <= totalCols; c++) {
      const colDef = columns[c - 1];
      const colLetter = getExcelColumnLetter(c);

      const cellSum = sumRow.getCell(c);
      cellSum.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF1F5F9' },
      };
      cellSum.border = borderThin;

      const cellSub = subtotalRow.getCell(c);
      cellSub.fill = {
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
      cellHdr.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF334155' },
      };
      cellHdr.border = borderThin;

      if (c === 8) {
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

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }
}
