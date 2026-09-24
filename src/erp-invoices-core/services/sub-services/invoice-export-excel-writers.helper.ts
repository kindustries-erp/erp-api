import * as ExcelJS from 'exceljs';
import {
  parseVatRateForDisplay,
  formatVatRate,
} from '../../helpers/invoice-mapper.helper';
import { classifyInvoiceLine } from '../../helpers/out-invoice-display.helper';
import {
  borderThin,
  formatTaxInvoiceStatus,
  INVOICE_TYPE_MAP,
  summaryColumns,
  detailedColumns,
  overviewColumns,
  debtColumns,
  finalizeSheetLayout,
} from './invoice-export-excel-columns.helper';

export * from './invoice-export-excel-columns.helper';

export const writeSummaryRows = (
  sheet: ExcelJS.Worksheet,
  invoiceList: any[],
  direction?: string,
  branchMap: Record<string, string> = {},
) => {
  let sumDiscount = 0;
  let sumPreVat = 0;
  let sumVat = 0;
  let sumTotal = 0;
  let sumNetOff = 0;
  let sumRemaining = 0;

  for (const inv of invoiceList) {
    const partnerName = direction === 'IN' ? inv.sellerName : inv.buyerName;
    const taxCode = direction === 'IN' ? inv.sellerTaxCode : inv.buyerTaxCode;
    const address = direction === 'IN' ? inv.sellerAddress : inv.buyerAddress;
    const invDiscount = Number(inv.discountAmount) || 0;
    const invPreVat = Number(inv.preVatAmount) || 0;
    const invVat = Number(inv.vatAmount) || 0;
    const invTotal = Number(inv.totalAmount) || 0;
    const invNetOff = Number((inv as any).netOffAmount) || 0;
    const remainingAmount = invTotal - invNetOff;

    sumDiscount += invDiscount;
    sumPreVat += invPreVat;
    sumVat += invVat;
    sumTotal += invTotal;
    sumNetOff += invNetOff;
    sumRemaining += remainingAmount;

    const fullDesc = [
      inv.description,
      (inv as any).notes,
      ...(inv.items || []).map((i: any) => i.description),
    ]
      .filter(Boolean)
      .join(' | ');

    const row = sheet.addRow({
      invoiceDate: inv.invoiceDate,
      serialNo: inv.serialNo,
      invoiceNo: inv.invoiceNo,
      partnerName,
      taxCode,
      address,
      headerDiscountAmount: invDiscount,
      preVat: invPreVat,
      vatRate: formatVatRate(inv.vatRate),
      vat: invVat,
      total: invTotal,
      licensePlate: inv.licensePlate || '',
      wo: inv.settlementOrder || '',
      description: fullDesc,
      statusName: formatTaxInvoiceStatus(inv.taxInvoiceStatus),
      branchName: branchMap[inv.branchId || ''] || '',
      netOffReferences: (inv as any).netOffReferences || '',
      netOffTransDate: (inv as any).netOffTransDate || '',
      netOffTransDesc: (inv as any).netOffTransDesc || '',
      netOffRefAmount: Number((inv as any).netOffRefAmount) || 0,
      netOffAmount: invNetOff,
      remainingAmount,
    });

    row.height = 20;
    row.font = { name: 'Calibri', size: 10 };

    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(4).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(6).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(7).numFmt = '#,##0.00';
    row.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(8).numFmt = '#,##0.00';
    row.getCell(9).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(10).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(10).numFmt = '#,##0.00';
    row.getCell(11).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(11).numFmt = '#,##0.00';
    row.getCell(12).alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };
    row.getCell(13).alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };
    row.getCell(14).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(15).alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };
    row.getCell(16).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(17).alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };
    row.getCell(18).alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };
    row.getCell(19).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(20).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(20).numFmt = '#,##0.00';
    row.getCell(21).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(21).numFmt = '#,##0.00';
    row.getCell(22).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(22).numFmt = '#,##0.00';

    for (let c = 1; c <= 22; c++) {
      row.getCell(c).border = borderThin;
    }
    for (let c = 17; c <= 21; c++) {
      row.getCell(c).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF0F9FF' },
      };
    }
    row.getCell(22).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFEFCE8' },
    };
  }

  finalizeSheetLayout(
    sheet,
    summaryColumns,
    {
      headerDiscountAmount: sumDiscount,
      preVat: sumPreVat,
      vat: sumVat,
      total: sumTotal,
      netOffAmount: sumNetOff,
      remainingAmount: sumRemaining,
    },
    4,
  );
};

export const writeDetailedRows = (
  sheet: ExcelJS.Worksheet,
  invoiceList: any[],
  direction?: string,
  branchMap: Record<string, string> = {},
  onAccumulate?: (payload: any) => void,
) => {
  let sumQty = 0;
  let sumPreVat = 0;
  let sumVat = 0;
  let sumTotal = 0;

  for (const inv of invoiceList) {
    const partnerName = direction === 'IN' ? inv.sellerName : inv.buyerName;
    const taxCode = direction === 'IN' ? inv.sellerTaxCode : inv.buyerTaxCode;
    const fullDesc = [
      inv.description,
      (inv as any).notes,
      ...(inv.items || []).map((i: any) => i.description),
    ]
      .filter(Boolean)
      .join(' | ');

    const descriptionLineCount = String(inv.description || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean).length;
    const invoiceLineCount = Math.max(
      inv.items?.length || 0,
      descriptionLineCount,
      1,
    );

    if (!inv.items || inv.items.length === 0) {
      const fallbackPreVat = Number(inv.preVatAmount) || 0;
      const fallbackVat = Number(inv.vatAmount) || 0;
      const fallbackTotal = Number(inv.totalAmount) || 0;
      const normalizedFallback = classifyInvoiceLine(
        {
          description: inv.description,
          unit: '',
          quantity: 0,
          unitPrice: 0,
          preVatAmount: fallbackPreVat,
          vatAmount: fallbackVat,
          totalAmount: fallbackTotal,
          discountAmount: Number(inv.discountAmount) || 0,
        },
        {
          buyerTaxCode: taxCode,
          direction: inv.direction,
          invoiceLineCount,
          taxInvoiceStatus: inv.taxInvoiceStatus,
          headerDiscountAmount: Number(inv.discountAmount) || 0,
          forReportExport: true,
        },
      );

      sumQty += Number(normalizedFallback.quantity) || 0;
      sumPreVat += Number(normalizedFallback.preVatAmount) || 0;
      sumVat += Number(normalizedFallback.vatAmount) || 0;
      sumTotal += Number(normalizedFallback.totalAmount) || 0;

      const row = sheet.addRow({
        invoiceDate: inv.invoiceDate,
        itemCode: '',
        itemName: inv.description || '',
        uom: '',
        serialNo: inv.serialNo,
        invoiceNo: inv.invoiceNo,
        partnerName,
        taxCode,
        qty: normalizedFallback.quantity,
        unitPrice: normalizedFallback.unitPrice,
        preVatAmount: normalizedFallback.preVatAmount,
        vatRate: formatVatRate(inv.vatRate),
        vatAmount: normalizedFallback.vatAmount,
        totalAmount: normalizedFallback.totalAmount,
        licensePlate: inv.licensePlate || '',
        wo: inv.settlementOrder || '',
        description: fullDesc,
        statusName: formatTaxInvoiceStatus(inv.taxInvoiceStatus),
        branchName: branchMap[inv.branchId || ''] || '',
        invoiceSubcategory:
          normalizedFallback.invoiceSubcategory === 'DISCOUNT'
            ? 'Chiết khấu'
            : normalizedFallback.invoiceSubcategory === 'RESCUE'
              ? 'Cứu hộ'
              : 'Thông thường',
      });

      row.height = 20;
      row.font = { name: 'Calibri', size: 10 };

      row.getCell(1).alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      row.getCell(2).alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell(4).alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      row.getCell(5).alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      row.getCell(6).alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      row.getCell(7).alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell(8).alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      row.getCell(9).alignment = {
        horizontal: 'right',
        vertical: 'middle',
      };
      row.getCell(9).numFmt = '#,##0.00';
      row.getCell(10).alignment = {
        horizontal: 'right',
        vertical: 'middle',
      };
      row.getCell(10).numFmt = '#,##0.00';
      row.getCell(11).alignment = {
        horizontal: 'right',
        vertical: 'middle',
      };
      row.getCell(11).numFmt = '#,##0.00';
      row.getCell(12).alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      row.getCell(13).alignment = {
        horizontal: 'right',
        vertical: 'middle',
      };
      row.getCell(13).numFmt = '#,##0.00';
      row.getCell(14).alignment = {
        horizontal: 'right',
        vertical: 'middle',
      };
      row.getCell(14).numFmt = '#,##0.00';
      row.getCell(15).alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      row.getCell(16).alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      row.getCell(17).alignment = {
        horizontal: 'left',
        vertical: 'middle',
      };
      row.getCell(18).alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      row.getCell(19).alignment = {
        horizontal: 'left',
        vertical: 'middle',
      };
      row.getCell(20).alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };

      for (let c = 1; c <= 20; c++) {
        row.getCell(c).border = borderThin;
      }

      onAccumulate?.({
        itemCode: '',
        itemName: inv.description || '',
        uom: '',
        qty: normalizedFallback.quantity,
        unitPrice: normalizedFallback.unitPrice,
        preVatAmount: normalizedFallback.preVatAmount,
        vatAmount: normalizedFallback.vatAmount,
        totalAmount: normalizedFallback.totalAmount,
      });
    } else {
      for (const item of inv.items) {
        const itemPreVat = Number(item.preVatAmount) || 0;
        const itemVatRateRaw = parseVatRateForDisplay(
          item.vatRate || inv.vatRate,
        );
        const itemVatAmount =
          Number(item.vatAmount) ||
          Math.round(itemPreVat * (Number(itemVatRateRaw) || 0));
        const itemTotalAmount =
          Number(item.totalAmount) || Math.round(itemPreVat + itemVatAmount);
        const normalizedItem = classifyInvoiceLine(
          {
            description: item.description || '',
            unit: item.unit || '',
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            preVatAmount: itemPreVat,
            vatAmount: itemVatAmount,
            totalAmount: itemTotalAmount,
            discountAmount: Number(item.discountAmount) || 0,
          },
          {
            buyerTaxCode: taxCode,
            direction: inv.direction,
            invoiceLineCount,
            taxInvoiceStatus: inv.taxInvoiceStatus,
            headerDiscountAmount: Number(inv.discountAmount) || 0,
            forReportExport: true,
          },
        );

        sumQty += Number(normalizedItem.quantity) || 0;
        sumPreVat += Number(normalizedItem.preVatAmount) || 0;
        sumVat += Number(normalizedItem.vatAmount) || 0;
        sumTotal += Number(normalizedItem.totalAmount) || 0;

        const row = sheet.addRow({
          invoiceDate: inv.invoiceDate,
          itemCode: item.itemCode || '',
          itemName: item.description || '',
          uom: (item.unit || '').trim().toUpperCase(),
          serialNo: inv.serialNo,
          invoiceNo: inv.invoiceNo,
          partnerName,
          taxCode,
          qty: normalizedItem.quantity,
          unitPrice: normalizedItem.unitPrice,
          preVatAmount: normalizedItem.preVatAmount,
          vatRate: formatVatRate(item.vatRate || inv.vatRate),
          vatAmount: normalizedItem.vatAmount,
          totalAmount: normalizedItem.totalAmount,
          licensePlate: inv.licensePlate || '',
          wo: inv.settlementOrder || '',
          description: fullDesc,
          statusName: formatTaxInvoiceStatus(inv.taxInvoiceStatus),
          branchName: branchMap[inv.branchId || ''] || '',
          invoiceSubcategory:
            normalizedItem.invoiceSubcategory === 'DISCOUNT'
              ? 'Chiết khấu'
              : normalizedItem.invoiceSubcategory === 'RESCUE'
                ? 'Cứu hộ'
                : 'Thông thường',
        });

        row.height = 20;
        row.font = { name: 'Calibri', size: 10 };

        row.getCell(1).alignment = {
          horizontal: 'center',
          vertical: 'middle',
        };
        row.getCell(2).alignment = {
          horizontal: 'center',
          vertical: 'middle',
        };
        row.getCell(3).alignment = {
          horizontal: 'left',
          vertical: 'middle',
        };
        row.getCell(4).alignment = {
          horizontal: 'center',
          vertical: 'middle',
        };
        row.getCell(5).alignment = {
          horizontal: 'center',
          vertical: 'middle',
        };
        row.getCell(6).alignment = {
          horizontal: 'center',
          vertical: 'middle',
        };
        row.getCell(7).alignment = {
          horizontal: 'left',
          vertical: 'middle',
        };
        row.getCell(8).alignment = {
          horizontal: 'center',
          vertical: 'middle',
        };
        row.getCell(9).alignment = {
          horizontal: 'right',
          vertical: 'middle',
        };
        row.getCell(9).numFmt = '#,##0.00';
        row.getCell(10).alignment = {
          horizontal: 'right',
          vertical: 'middle',
        };
        row.getCell(10).numFmt = '#,##0.00';
        row.getCell(11).alignment = {
          horizontal: 'right',
          vertical: 'middle',
        };
        row.getCell(11).numFmt = '#,##0.00';
        row.getCell(12).alignment = {
          horizontal: 'center',
          vertical: 'middle',
        };
        row.getCell(13).alignment = {
          horizontal: 'right',
          vertical: 'middle',
        };
        row.getCell(13).numFmt = '#,##0.00';
        row.getCell(14).alignment = {
          horizontal: 'right',
          vertical: 'middle',
        };
        row.getCell(14).numFmt = '#,##0.00';
        row.getCell(15).alignment = {
          horizontal: 'center',
          vertical: 'middle',
        };
        row.getCell(16).alignment = {
          horizontal: 'center',
          vertical: 'middle',
        };
        row.getCell(17).alignment = {
          horizontal: 'left',
          vertical: 'middle',
        };
        row.getCell(18).alignment = {
          horizontal: 'center',
          vertical: 'middle',
        };
        row.getCell(19).alignment = {
          horizontal: 'left',
          vertical: 'middle',
        };
        row.getCell(20).alignment = {
          horizontal: 'center',
          vertical: 'middle',
        };

        for (let c = 1; c <= 20; c++) {
          row.getCell(c).border = borderThin;
        }

        onAccumulate?.({
          itemCode: item.itemCode || '',
          itemName: item.description || '',
          uom: item.unit || '',
          qty: normalizedItem.quantity,
          unitPrice: normalizedItem.unitPrice,
          preVatAmount: normalizedItem.preVatAmount,
          vatAmount: normalizedItem.vatAmount,
          totalAmount: normalizedItem.totalAmount,
        });
      }
    }
  }

  finalizeSheetLayout(
    sheet,
    detailedColumns,
    {
      qty: sumQty,
      preVatAmount: sumPreVat,
      vatAmount: sumVat,
      totalAmount: sumTotal,
    },
    3,
  );
};

export const writeOverviewRows = (
  sheet: ExcelJS.Worksheet,
  overviewMap: Map<string, any>,
) => {
  const overviewRows = Array.from(overviewMap.values()).sort(
    (a, b) =>
      a.itemName.localeCompare(b.itemName, 'vi') ||
      a.itemCode.localeCompare(b.itemCode, 'vi'),
  );

  let sumQty = 0;
  let sumPreVat = 0;
  let sumVat = 0;
  let sumTotal = 0;
  let sumLines = 0;

  for (const rowData of overviewRows) {
    const avgUnitPrice =
      rowData.totalQty > 0
        ? rowData.totalUnitPriceWeight / rowData.totalQty
        : rowData.lineCount > 0
          ? rowData.totalPreVat / rowData.lineCount
          : 0;

    sumQty += rowData.totalQty;
    sumPreVat += rowData.totalPreVat;
    sumVat += rowData.totalVat;
    sumTotal += rowData.totalAmount;
    sumLines += rowData.lineCount;

    const row = sheet.addRow({
      itemCode: rowData.itemCode,
      itemName: rowData.itemName,
      uom: rowData.uom,
      totalQty: rowData.totalQty,
      avgUnitPrice,
      totalPreVat: rowData.totalPreVat,
      totalVat: rowData.totalVat,
      totalAmount: rowData.totalAmount,
      lineCount: rowData.lineCount,
    });

    row.height = 20;
    row.font = { name: 'Calibri', size: 10 };

    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(4).numFmt = '#,##0.00';
    row.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(5).numFmt = '#,##0.00';
    row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(6).numFmt = '#,##0.00';
    row.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(7).numFmt = '#,##0.00';
    row.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(8).numFmt = '#,##0.00';
    row.getCell(9).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(9).numFmt = '#,##0';

    for (let c = 1; c <= 9; c++) {
      row.getCell(c).border = borderThin;
    }
  }

  finalizeSheetLayout(
    sheet,
    overviewColumns,
    {
      totalQty: sumQty,
      totalPreVat: sumPreVat,
      totalVat: sumVat,
      totalAmount: sumTotal,
      lineCount: sumLines,
    },
    2,
  );
};

export const writeDebtRows = (
  sheet: ExcelJS.Worksheet,
  invoiceList: any[],
  direction?: string,
  cumMap: Map<string, { cumTotal: number; cumNetOff: number }> = new Map(),
) => {
  const partnerDebtMap = new Map<
    string,
    {
      taxCode: string;
      partnerName: string;
      invoiceCount: number;
      totalAmount: number;
      netOffAmount: number;
      remainingAmount: number;
      cumulativeDebt: number;
      cumulativeNetOff: number;
      cumulativeRemaining: number;
    }
  >();

  for (const inv of invoiceList) {
    const partnerName = direction === 'IN' ? inv.sellerName : inv.buyerName;
    const taxCode = direction === 'IN' ? inv.sellerTaxCode : inv.buyerTaxCode;
    const pName = String(partnerName || '').trim() || '(Chưa có tên)';
    const tCode = String(taxCode || '').trim();
    const key = `${tCode}:::${pName}`;

    const cumData = cumMap.get(key);
    const current = partnerDebtMap.get(key) || {
      taxCode: tCode,
      partnerName: pName,
      invoiceCount: 0,
      totalAmount: 0,
      netOffAmount: 0,
      remainingAmount: 0,
      cumulativeDebt: cumData ? cumData.cumTotal : 0,
      cumulativeNetOff: cumData ? cumData.cumNetOff : 0,
      cumulativeRemaining: cumData ? cumData.cumTotal - cumData.cumNetOff : 0,
    };

    const invTotal = Number(inv.totalAmount) || 0;
    const invNetOff = Number((inv as any).netOffAmount) || 0;
    const invRemaining = invTotal - invNetOff;

    current.invoiceCount += 1;
    current.totalAmount += invTotal;
    current.netOffAmount += invNetOff;
    current.remainingAmount += invRemaining;
    if (!cumData) {
      current.cumulativeDebt += invTotal;
      current.cumulativeNetOff += invNetOff;
      current.cumulativeRemaining += invRemaining;
    }

    partnerDebtMap.set(key, current);
  }

  const partnerDebtRows = Array.from(partnerDebtMap.values()).sort(
    (a, b) =>
      b.cumulativeRemaining - a.cumulativeRemaining ||
      b.remainingAmount - a.remainingAmount ||
      a.partnerName.localeCompare(b.partnerName, 'vi'),
  );

  let stt = 1;
  let sumInvoices = 0;
  let sumTotalAmount = 0;
  let sumNetOffAmount = 0;
  let sumRemainingAmount = 0;
  let sumCumulativeDebt = 0;
  let sumCumulativeNetOff = 0;
  let sumCumulativeRemaining = 0;

  for (const rowData of partnerDebtRows) {
    sumInvoices += rowData.invoiceCount;
    sumTotalAmount += rowData.totalAmount;
    sumNetOffAmount += rowData.netOffAmount;
    sumRemainingAmount += rowData.remainingAmount;
    sumCumulativeDebt += rowData.cumulativeDebt;
    sumCumulativeNetOff += rowData.cumulativeNetOff;
    sumCumulativeRemaining += rowData.cumulativeRemaining;

    const row = sheet.addRow({
      stt: stt++,
      taxCode: rowData.taxCode,
      partnerName: rowData.partnerName,
      invoiceCount: rowData.invoiceCount,
      totalAmount: rowData.totalAmount,
      netOffAmount: rowData.netOffAmount,
      remainingAmount: rowData.remainingAmount,
      cumulativeDebt: rowData.cumulativeDebt,
      cumulativeNetOff: rowData.cumulativeNetOff,
      cumulativeRemaining: rowData.cumulativeRemaining,
      status: rowData.cumulativeRemaining > 0 ? 'Còn nợ' : 'Đã tất toán',
    });

    row.height = 20;
    row.font = { name: 'Calibri', size: 10 };

    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(4).numFmt = '#,##0';
    row.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(5).numFmt = '#,##0.00';
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
    row.getCell(11).alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };

    for (let c = 1; c <= 11; c++) {
      row.getCell(c).border = borderThin;
    }
  }

  finalizeSheetLayout(
    sheet,
    debtColumns,
    {
      invoiceCount: sumInvoices,
      totalAmount: sumTotalAmount,
      netOffAmount: sumNetOffAmount,
      remainingAmount: sumRemainingAmount,
      cumulativeDebt: sumCumulativeDebt,
      cumulativeNetOff: sumCumulativeNetOff,
      cumulativeRemaining: sumCumulativeRemaining,
    },
    3,
  );
};
