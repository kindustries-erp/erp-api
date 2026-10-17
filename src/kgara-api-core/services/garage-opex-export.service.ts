import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';

import type { ExportProgressReporter } from '../../common/export-jobs/export-job-runner';
import {
  createDashboardSheet,
  writeDashboardHeader,
  writeKpiCards,
  writeDataTable,
  DASHBOARD_DATA_START_COL,
  chartAnchor,
  rowAfterCharts,
  setDashboardPrintArea,
  type DashboardKpi,
} from '../../common/xlsx-charts/dashboard-sheet.helper';
import { injectCharts } from '../../common/xlsx-charts/xlsx-chart-injector';
import {
  CHART_PALETTE,
  LABEL_MONEY_FMT,
  type XlsxChartSpec,
} from '../../common/xlsx-charts/xlsx-chart.types';
import {
  applyStandardExcelReportLayout,
  initSheetStructure,
  borderThin,
  type ExcelReportColumnDef,
} from '../helpers/kgara-excel-style.helper';
import {
  applyOpexListFilters,
  applyOpexListSorting,
  COGS_GROUP_CATEGORIES,
} from '../helpers/garage-opex-query.builder';
import { KgaraOperatingExpense } from '../entities/kgara_operating_expense.entity';
import { GaragePnlService } from './garage-pnl.service';
import type { GarageOpexExportDto } from '../dto/garage-opex-export.dto';

const MONEY = '#,##0';

const OPEX_DETAIL_COLUMNS: ExcelReportColumnDef[] = [
  { header: 'STT', key: 'stt', width: 6, align: 'center' },
  { header: 'Kỳ báo cáo', key: 'period', width: 14, align: 'center' },
  { header: 'Nhóm chi phí', key: 'costGroup', width: 16, align: 'center' },
  { header: 'Mã danh mục', key: 'categoryKey', width: 22 },
  { header: 'Tên danh mục chi phí', key: 'categoryName', width: 32 },
  {
    header: 'Số tiền (VND)',
    key: 'amount',
    width: 22,
    align: 'right',
    isSum: true,
    style: { numFmt: MONEY },
  },
  {
    header: 'Riêng OJ (VND)',
    key: 'ojAmount',
    width: 20,
    align: 'right',
    isSum: true,
    style: { numFmt: MONEY },
  },
  { header: 'Định kỳ', key: 'recurrenceType', width: 14, align: 'center' },
  { header: 'Nguồn phát sinh', key: 'source', width: 18, align: 'center' },
  { header: 'Ghi chú', key: 'note', width: 34 },
  { header: 'Ngày tạo', key: 'createdAt', width: 16, align: 'center' },
];

function getCostGroup(categoryKey: string): string {
  if (
    categoryKey === 'HOA_HONG_TRUC_TIEP' ||
    categoryKey === 'CHI_PHI_TRUC_TIEP_KHAC' ||
    COGS_GROUP_CATEGORIES.includes(categoryKey)
  ) {
    return 'Giá vốn (COGS)';
  }
  if (categoryKey.startsWith('HOA_HONG_')) {
    return 'Hoa hồng';
  }
  return 'CP Vận hành';
}

@Injectable()
export class GarageOpexExportService {
  constructor(
    @InjectRepository(KgaraOperatingExpense)
    private readonly opexRepo: Repository<KgaraOperatingExpense>,
    private readonly pnlService: GaragePnlService,
  ) {}

  async exportExcel(
    dto: GarageOpexExportDto,
    onProgress: ExportProgressReporter = () => undefined,
  ): Promise<Buffer> {
    const totalUnits = 100;
    onProgress(10, totalUnits, 'Đang truy vấn dữ liệu chi phí vận hành...');

    const qb = this.opexRepo.createQueryBuilder('opex');
    applyOpexListFilters(qb, dto as any);
    applyOpexListSorting(qb, dto.sorts);

    const rawItems = await qb.getMany();

    onProgress(35, totalUnits, 'Đang tổng hợp số liệu và phân nhóm chi phí...');

    // Lấy thông tin tháng kỳ báo cáo cho P&L
    let pnlYear = dto.year;
    let pnlMonth = dto.month;
    if (!pnlYear || !pnlMonth) {
      if (dto.date_to) {
        const parts = dto.date_to.split('-');
        pnlYear = Number(parts[0]);
        pnlMonth = Number(parts[1]);
      } else if (rawItems.length > 0) {
        pnlYear = rawItems[0].periodYear;
        pnlMonth = rawItems[0].periodMonth;
      } else {
        const now = new Date();
        pnlYear = now.getFullYear();
        pnlMonth = now.getMonth() + 1;
      }
    }

    onProgress(50, totalUnits, 'Đang tải báo cáo lợi nhuận P&L...');
    let pnlReport: any = null;
    try {
      pnlReport = await this.pnlService.getPnlReport(pnlYear, pnlMonth);
    } catch {
      // Bỏ qua lỗi nếu dữ liệu tháng chưa có
    }

    onProgress(70, totalUnits, 'Đang tạo bảng tính Excel...');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Liouni ERP';
    workbook.lastModifiedBy = 'Liouni ERP';
    workbook.created = new Date();

    // 1. Sheet 1: Dashboard & KPI Overview
    const chartSpecs = this.buildDashboardSheet(
      workbook,
      rawItems,
      dto,
      pnlReport,
    );

    // 2. Sheet 2: Bảng kê chi tiết chi phí (chuẩn erp-invoice layout)
    this.buildDetailSheet(workbook, rawItems);

    // 3. Sheet 3: Báo cáo Lợi nhuận P&L
    this.buildPnlReportSheet(workbook, pnlReport, pnlYear, pnlMonth);

    onProgress(90, totalUnits, 'Đang kết xuất và định dạng biểu đồ...');
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    if (chartSpecs.length > 0) {
      try {
        const finalBuffer = await injectCharts(
          buffer,
          'Tổng quan chi phí',
          chartSpecs,
        );
        onProgress(100, totalUnits, 'Hoàn tất.');
        return finalBuffer;
      } catch {
        onProgress(100, totalUnits, 'Hoàn tất.');
        return buffer;
      }
    }

    onProgress(100, totalUnits, 'Hoàn tất.');
    return buffer;
  }

  private buildDashboardSheet(
    workbook: ExcelJS.Workbook,
    items: KgaraOperatingExpense[],
    dto: GarageOpexExportDto,
    pnlReport: any,
  ): XlsxChartSpec[] {
    const sheet = createDashboardSheet(workbook, 'Tổng quan chi phí');

    let totalOpex = 0;
    let totalCogs = 0;
    let totalCommission = 0;
    let totalOj = 0;

    const categoryMap = new Map<
      string,
      { name: string; group: string; amount: number; oj: number }
    >();

    items.forEach((item) => {
      const amt = Number(item.amount) || 0;
      const oj = Number(item.ojAmount) || 0;
      const group = getCostGroup(item.categoryKey);

      if (group === 'CP Vận hành') totalOpex += amt;
      else if (group === 'Giá vốn (COGS)') totalCogs += amt;
      else if (group === 'Hoa hồng') totalCommission += amt;

      totalOj += oj;

      const existing = categoryMap.get(item.categoryKey) || {
        name: item.categoryName || item.categoryKey,
        group,
        amount: 0,
        oj: 0,
      };
      existing.amount += amt;
      existing.oj += oj;
      categoryMap.set(item.categoryKey, existing);
    });

    const periodStr =
      dto.date_from && dto.date_to
        ? `Kỳ: ${dto.date_from} đến ${dto.date_to}`
        : dto.year && dto.month
          ? `Kỳ: ${String(dto.month).padStart(2, '0')}/${dto.year}`
          : 'Toàn bộ dữ liệu chi phí đã lọc';

    const headerEnd = writeDashboardHeader(
      sheet,
      'Dashboard Chi phí Vận hành & Phân bổ Garage',
      [
        periodStr,
        `Tổng số khoản mục: ${items.length} · Thời gian xuất: ${new Date().toLocaleString('vi-VN')}`,
      ],
    );

    const kpiCards: DashboardKpi[] = [
      { label: 'Tổng CP Vận hành (OPEX)', value: totalOpex, numFmt: MONEY },
      { label: 'Giá vốn nhập tay (COGS)', value: totalCogs, numFmt: MONEY },
      {
        label: 'Tổng Hoa hồng & Thưởng',
        value: totalCommission,
        numFmt: MONEY,
      },
      { label: 'Chi phí riêng phân khúc OJ', value: totalOj, numFmt: MONEY },
    ];

    const kpiEnd = writeKpiCards(sheet, headerEnd, kpiCards);

    // Bảng dữ liệu cơ cấu chi phí
    const sortedCategories = Array.from(categoryMap.values()).sort(
      (a, b) => b.amount - a.amount,
    );
    const totalAll = totalOpex + totalCogs + totalCommission || 1;

    const tableRows = sortedCategories
      .slice(0, 15)
      .map((c) => [
        c.name,
        c.group,
        c.amount,
        c.oj,
        Number(((c.amount / totalAll) * 100).toFixed(2)),
      ]);

    const dataStartCol = DASHBOARD_DATA_START_COL;
    const tableRefs = writeDataTable(sheet, {
      startRow: 4,
      startCol: dataStartCol,
      title: 'Dữ liệu Top danh mục chi phí',
      headers: ['Danh mục', 'Nhóm', 'Số tiền', 'Riêng OJ', 'Tỷ trọng %'],
      rows: tableRows,
      numFmts: [undefined, undefined, MONEY, MONEY, '0.00"%"'],
      columnWidths: [28, 16, 18, 16, 12],
    });

    const chartSpecs: XlsxChartSpec[] = [];

    if (tableRows.length > 0) {
      const chartRow = kpiEnd + 1;
      sheet.mergeCells(chartRow, 1, chartRow + 15, 8);
      sheet.mergeCells(chartRow, 9, chartRow + 15, 16);

      chartSpecs.push(
        {
          type: 'bar',
          title: 'Cơ cấu chi phí theo Danh mục (Top 10)',
          anchor: chartAnchor(chartRow, 0),
          categoriesRef: tableRefs.ref(0),
          categories: tableRows.map((r) => String(r[0])),
          series: [
            {
              name: 'Số tiền (VND)',
              valuesRef: tableRefs.ref(2),
              values: tableRows.map((r) => Number(r[2])),
              color: CHART_PALETTE[0],
            },
          ],
          dataLabels: true,
          labelNumFmt: LABEL_MONEY_FMT,
        },
        {
          type: 'bar',
          title: 'Chi phí phân khúc riêng OJ',
          anchor: chartAnchor(chartRow, 1),
          categoriesRef: tableRefs.ref(0),
          categories: tableRows.map((r) => String(r[0])),
          series: [
            {
              name: 'OJ (VND)',
              valuesRef: tableRefs.ref(3),
              values: tableRows.map((r) => Number(r[3])),
              color: CHART_PALETTE[1],
            },
          ],
          dataLabels: true,
          labelNumFmt: LABEL_MONEY_FMT,
        },
      );

      const afterCharts = rowAfterCharts(chartRow, 1);
      setDashboardPrintArea(sheet, afterCharts);
    }

    return chartSpecs;
  }

  private buildDetailSheet(
    workbook: ExcelJS.Workbook,
    items: KgaraOperatingExpense[],
  ): void {
    const sheet = workbook.addWorksheet('Bảng kê chi tiết chi phí', {
      views: [{ state: 'frozen', ySplit: 4 }],
      properties: { tabColor: { argb: 'FF2563EB' } },
    });

    initSheetStructure(sheet, OPEX_DETAIL_COLUMNS);

    let sumAmount = 0;
    let sumOjAmount = 0;

    items.forEach((item, index) => {
      const amt = Number(item.amount) || 0;
      const ojAmt = Number(item.ojAmount) || 0;
      sumAmount += amt;
      sumOjAmount += ojAmt;

      const period = `${String(item.periodMonth).padStart(2, '0')}/${item.periodYear}`;
      const costGroup = getCostGroup(item.categoryKey);
      const recurrence =
        item.recurrenceType === 'monthly'
          ? 'Hàng tháng'
          : item.recurrenceType === 'yearly'
            ? 'Hàng năm'
            : 'Một lần';
      const source = item.sourceCashflowVoucherId
        ? 'Phiếu chi Garage'
        : 'Nhập tay';
      const createdAt = item.createdAt
        ? new Date(item.createdAt).toLocaleDateString('vi-VN')
        : '';

      const row = sheet.addRow({
        stt: index + 1,
        period,
        costGroup,
        categoryKey: item.categoryKey,
        categoryName: item.categoryName,
        amount: amt,
        ojAmount: ojAmt,
        recurrenceType: recurrence,
        source,
        note: item.note || '',
        createdAt,
      });

      row.height = 20;
      row.font = { name: 'Calibri', size: 10 };
      row.alignment = { vertical: 'middle' };

      // Apply borders & alignment
      OPEX_DETAIL_COLUMNS.forEach((col, cIdx) => {
        const cell = row.getCell(cIdx + 1);
        cell.border = borderThin;
        if (col.align) {
          cell.alignment = {
            horizontal: col.align,
            vertical: 'middle',
          };
        }
        if (col.style?.numFmt) {
          cell.numFmt = col.style.numFmt;
        }
      });

      // Zebra striping
      if (index % 2 === 1) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFC' },
        };
      }
    });

    applyStandardExcelReportLayout(sheet, OPEX_DETAIL_COLUMNS, 5, {
      amount: sumAmount,
      ojAmount: sumOjAmount,
    });
  }

  private buildPnlReportSheet(
    workbook: ExcelJS.Workbook,
    pnlReport: any,
    year: number,
    month: number,
  ): void {
    const sheet = workbook.addWorksheet(`Báo cáo P&L Tháng ${month}-${year}`, {
      views: [{ state: 'frozen', ySplit: 3 }],
      properties: { tabColor: { argb: 'FF059669' } },
    });

    sheet.columns = [
      { header: 'Chỉ tiêu tài chính', key: 'metric', width: 44 },
      { header: 'Toàn bộ Garage (VND)', key: 'amount', width: 24 },
      { header: 'Riêng phân khúc OJ (VND)', key: 'ojAmount', width: 24 },
      { header: 'Ghi chú', key: 'note', width: 32 },
    ];

    // Tiêu đề
    sheet.spliceRows(1, 0, [
      `BÁO CÁO LỢI NHUẬN (P&L) GARAGE - THÁNG ${String(month).padStart(2, '0')}/${year}`,
      '',
      '',
      '',
    ]);
    sheet.mergeCells('A1:D1');
    const titleRow = sheet.getRow(1);
    titleRow.font = {
      name: 'Calibri',
      size: 13,
      bold: true,
      color: { argb: 'FF0F172A' },
    };
    titleRow.alignment = { horizontal: 'center', vertical: 'middle' };
    titleRow.height = 28;

    // Header bảng
    const headerRow = sheet.getRow(3);
    headerRow.font = {
      name: 'Calibri',
      size: 10.5,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF334155' },
    };
    headerRow.height = 24;
    for (let c = 1; c <= 4; c++) {
      headerRow.getCell(c).border = borderThin;
    }

    if (!pnlReport) {
      const emptyRow = sheet.addRow([
        'Chưa có dữ liệu P&L cho tháng được chọn',
        '',
        '',
        '',
      ]);
      emptyRow.font = { italic: true };
      return;
    }

    const rows: {
      label: string;
      amount: number;
      oj: number;
      note: string;
      group?: boolean;
    }[] = [
      {
        label: 'I. DOANH THU THUẦN',
        amount: pnlReport.revenue?.total || 0,
        oj: pnlReport.revenue?.ojTotal || 0,
        note: 'Doanh thu dịch vụ hoàn thành',
        group: true,
      },
      {
        label: '   1. Doanh thu dịch vụ & công sửa chữa',
        amount: pnlReport.revenue?.serviceTotal || 0,
        oj: pnlReport.revenue?.ojServiceTotal || 0,
        note: '',
      },
      {
        label: '   2. Doanh thu phụ tùng',
        amount: pnlReport.revenue?.partsTotal || 0,
        oj: pnlReport.revenue?.ojPartsTotal || 0,
        note: '',
      },
      {
        label: 'II. GIÁ VỐN HÀNG BÁN (COGS)',
        amount: pnlReport.cogs?.total || 0,
        oj: pnlReport.cogs?.ojTotal || 0,
        note: 'Chi phí phụ tùng & gia công ngoài',
        group: true,
      },
      {
        label: '   1. Giá vốn phụ tùng & vật tư',
        amount: pnlReport.cogs?.partsCost || 0,
        oj: pnlReport.cogs?.ojPartsCost || 0,
        note: '',
      },
      {
        label: '   2. Chi phí gia công ngoài (Outsource)',
        amount: pnlReport.cogs?.subcontractCost || 0,
        oj: pnlReport.cogs?.ojSubcontractCost || 0,
        note: '',
      },
      {
        label: 'III. LỢI NHUẬN GỘP (GROSS PROFIT)',
        amount: pnlReport.grossProfit?.total || 0,
        oj: pnlReport.grossProfit?.ojTotal || 0,
        note: 'Doanh thu thuần - Giá vốn',
        group: true,
      },
      {
        label: 'IV. CHI PHÍ VẬN HÀNH (OPEX)',
        amount: pnlReport.opex?.total || 0,
        oj: pnlReport.opex?.ojTotal || 0,
        note: 'Điện nước, mặt bằng, lương & bảo trì',
        group: true,
      },
      ...(pnlReport.opex?.items || []).map((i: any) => ({
        label: `   · ${i.categoryName}`,
        amount: Number(i.amount) || 0,
        oj: Number(i.ojAmount) || 0,
        note: i.note || '',
      })),
      {
        label: 'V. LỢI NHUẬN RÒNG (TRƯỚC HOA HỒNG)',
        amount: pnlReport.summary?.netProfitBeforeCommission || 0,
        oj: 0,
        note: 'Lợi nhuận gộp - OPEX',
        group: true,
      },
      {
        label: 'VI. HOA HỒNG & THƯỞNG DỊCH VỤ',
        amount: pnlReport.commission?.total || 0,
        oj: pnlReport.commission?.ojTotal || 0,
        note: 'Hoa hồng Sale & 10% LN ròng DV',
        group: true,
      },
      {
        label: '   1. Hoa hồng Sale xe ký gửi',
        amount: pnlReport.commission?.saleCommission || 0,
        oj: 0,
        note: '',
      },
      {
        label: '   2. Hoa hồng cho DV (10% Lợi nhuận ròng)',
        amount: pnlReport.commission?.dvCommission || 0,
        oj: 0,
        note: '',
      },
      {
        label: 'VII. LỢI NHUẬN RÒNG CÒN LẠI CỦA GARAGE',
        amount: pnlReport.summary?.netProfitAfterCommission || 0,
        oj: 0,
        note: 'LN ròng sau khi trừ hoa hồng',
        group: true,
      },
    ];

    rows.forEach((r) => {
      const addedRow = sheet.addRow([r.label, r.amount, r.oj, r.note]);
      addedRow.height = r.group ? 22 : 19;
      addedRow.font = {
        name: 'Calibri',
        size: r.group ? 10.5 : 10,
        bold: Boolean(r.group),
        color: r.group ? { argb: 'FF0F172A' } : { argb: 'FF334155' },
      };
      if (r.group) {
        addedRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE2E8F0' },
        };
      }
      for (let c = 1; c <= 4; c++) {
        const cell = addedRow.getCell(c);
        cell.border = borderThin;
        if (c === 2 || c === 3) {
          cell.numFmt = MONEY;
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        } else {
          cell.alignment = { vertical: 'middle' };
        }
      }
    });
  }
}
