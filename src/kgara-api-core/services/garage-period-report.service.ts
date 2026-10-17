import { Injectable } from '@nestjs/common';

import type { ExportProgressReporter } from '../../common/export-jobs/export-job-runner';
import type {
  GarageDashboardExportDto,
  GarageDebtsExportDto,
} from '../dto/garage-export.dto';
import type {
  GarageDebtExportRow,
  GarageDebtGroupExportSection,
} from '../helpers/garage-debts-export.helper';
import { resolveBucketUnit } from '../helpers/garage-period-bucket.helper';
import { reportMonthOf } from '../helpers/garage-pnl-month.helper';
import { buildGaragePeriodReport } from '../helpers/garage-period-report.helper';
import type { PreviousPeriodData } from '../helpers/garage-period-report.types';
import { previousPeriodRange } from '../helpers/garage-period-previous.helper';
import { resolvePeriodReportSections } from '../helpers/garage-period-report-sections.helper';
import { GarageDebtsExportService } from './garage-debts-export.service';
import { GaragePeriodReportQueries } from './garage-period-report-queries.service';
import { GaragePeriodTimelineQueries } from './garage-period-timeline-queries.service';
import { GARAGE_DEBT_BASELINE_DATE } from './kgara-customers-debt-query.service';

/**
 * Báo cáo Garage theo kỳ (tab Tổng quan): gom công nợ theo nhóm đối tượng,
 * nợ quá hạn còn mở, phiếu thu chi xưởng và lãi gộp trong kỳ thành một file Excel.
 */
@Injectable()
export class GaragePeriodReportService {
  static readonly PROGRESS_TOTAL_UNITS = 100;

  constructor(
    private readonly debtsExport: GarageDebtsExportService,
    private readonly queries: GaragePeriodReportQueries,
    private readonly timelines: GaragePeriodTimelineQueries,
  ) {}

  async exportExcel(
    branchId: string,
    dto: GarageDashboardExportDto,
    onProgress: ExportProgressReporter = () => undefined,
  ): Promise<Buffer> {
    const total = GaragePeriodReportService.PROGRESS_TOTAL_UNITS;
    const asOfDate = new Date();
    const periodFilters: GarageDebtsExportDto = {
      mode: 'by-period',
      from: dto.from,
      to: dto.to,
    };
    // Nợ còn mở: từ mốc ghi nhận đến nay, không giới hạn theo kỳ
    const openFilters: GarageDebtsExportDto = {
      mode: 'by-period',
      from: GARAGE_DEBT_BASELINE_DATE,
    };

    const sections = resolvePeriodReportSections(dto.reportType);
    // Dashboard dùng cả công nợ trong kỳ, nợ quá hạn và thu chi nên kéo theo các nguồn đó.
    const needsDebts = sections.has('debts') || sections.has('dashboard');
    const needsOpenDebts = sections.has('overdue') || sections.has('dashboard');
    const needsVouchers = sections.has('cashflow') || sections.has('dashboard');
    const needsPnl = sections.has('pnl');

    let customerRows: GarageDebtExportRow[] = [];
    let supplierRows: GarageDebtExportRow[] = [];
    let customerSections: GarageDebtGroupExportSection[] | undefined;
    if (needsDebts) {
      onProgress(5, total, 'Đang truy vấn công nợ trong kỳ...');
      [customerRows, supplierRows] = await Promise.all([
        this.debtsExport.loadCustomerRows(branchId, periodFilters),
        this.debtsExport.loadSupplierRows(branchId, periodFilters),
      ]);

      onProgress(30, total, 'Đang phân nhóm theo đối tượng...');
      ({ customerSections } = await this.debtsExport.loadCustomerGroups(
        branchId,
        periodFilters,
        asOfDate,
      ));
    }

    let openCustomerRows: GarageDebtExportRow[] = [];
    let openSupplierRows: GarageDebtExportRow[] = [];
    if (needsOpenDebts) {
      onProgress(50, total, 'Đang tổng hợp nợ quá hạn...');
      [openCustomerRows, openSupplierRows] = await Promise.all([
        this.debtsExport.loadCustomerRows(branchId, openFilters),
        this.debtsExport.loadSupplierRows(branchId, openFilters),
      ]);
    }

    onProgress(65, total, 'Đang tổng hợp thu chi và báo cáo lợi nhuận...');
    // Chart theo thời gian gom ngày/tuần/tháng theo độ dài kỳ; chỉ truy vấn khi sheet cần
    const bucketUnit = resolveBucketUnit(dto.from, dto.to);
    const [vouchers, pnlMonths, branchLabel, revenueTimeline, debtTimeline] =
      await Promise.all([
        needsVouchers
          ? this.queries.loadVouchers(dto.from, dto.to, branchId || undefined)
          : [],
        // P&L theo tháng: 12 tháng kết thúc ở tháng chứa ngày kết thúc kỳ (không vượt hôm nay)
        needsPnl
          ? this.queries.loadPnlMonthly(reportMonthOf(dto.to, asOfDate))
          : [],
        this.debtsExport.resolveBranchLabel(branchId),
        needsPnl ? this.timelines.loadRevenueTimeline(dto.from, dto.to) : [],
        sections.has('dashboard')
          ? this.timelines.loadDebtTimeline(
              dto.from,
              dto.to,
              branchId || undefined,
            )
          : [],
      ]);

    // Kỳ liền trước (cùng độ dài) để dòng so sánh ±% trên thẻ Dashboard
    let previousPeriod: PreviousPeriodData | undefined;
    const prevRange = sections.has('dashboard')
      ? previousPeriodRange(dto.from, dto.to, GARAGE_DEBT_BASELINE_DATE)
      : undefined;
    if (prevRange) {
      const prevFilters: GarageDebtsExportDto = {
        mode: 'by-period',
        from: prevRange.from,
        to: prevRange.to,
      };
      const [prevVouchers, prevCustomerRows, prevSupplierRows] =
        await Promise.all([
          this.queries.loadVouchers(
            prevRange.from,
            prevRange.to,
            branchId || undefined,
          ),
          this.debtsExport.loadCustomerRows(branchId, prevFilters),
          this.debtsExport.loadSupplierRows(branchId, prevFilters),
        ]);
      previousPeriod = {
        vouchers: prevVouchers,
        customerRows: prevCustomerRows,
        supplierRows: prevSupplierRows,
      };
    }

    onProgress(85, total, 'Đang tạo file Excel...');
    const buffer = await buildGaragePeriodReport({
      reportType: dto.reportType,
      bucketUnit,
      revenueTimeline,
      debtTimeline,
      from: dto.from,
      to: dto.to,
      asOfDate,
      branchLabel,
      pnlMonths,
      vouchers,
      customerRows,
      supplierRows,
      customerSections,
      openCustomerRows,
      openSupplierRows,
      previousPeriod,
    });

    onProgress(100, total, 'Hoàn tất.');
    return buffer;
  }
}
