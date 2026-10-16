import { Injectable } from '@nestjs/common';

import type { ExportProgressReporter } from '../../common/export-jobs/export-job-runner';
import type {
  GarageDashboardExportDto,
  GarageDebtsExportDto,
} from '../dto/garage-export.dto';
import { reportMonthOf } from '../helpers/garage-pnl-month.helper';
import { buildGaragePeriodReport } from '../helpers/garage-period-report.helper';
import { GarageDebtsExportService } from './garage-debts-export.service';
import { GaragePeriodReportQueries } from './garage-period-report-queries.service';
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

    onProgress(5, total, 'Đang truy vấn công nợ trong kỳ...');
    const [customerRows, supplierRows] = await Promise.all([
      this.debtsExport.loadCustomerRows(branchId, periodFilters),
      this.debtsExport.loadSupplierRows(branchId, periodFilters),
    ]);

    onProgress(30, total, 'Đang phân nhóm theo đối tượng...');
    const { customerSections } = await this.debtsExport.loadCustomerGroups(
      branchId,
      periodFilters,
      asOfDate,
    );

    onProgress(50, total, 'Đang tổng hợp nợ quá hạn...');
    const [openCustomerRows, openSupplierRows] = await Promise.all([
      this.debtsExport.loadCustomerRows(branchId, openFilters),
      this.debtsExport.loadSupplierRows(branchId, openFilters),
    ]);

    onProgress(65, total, 'Đang tổng hợp thu chi và báo cáo lợi nhuận...');
    const [vouchers, pnlMonths, branchLabel] = await Promise.all([
      this.queries.loadVouchers(dto.from, dto.to, branchId || undefined),
      // P&L theo tháng: 12 tháng kết thúc ở tháng chứa ngày kết thúc kỳ (không vượt hôm nay)
      this.queries.loadPnlMonthly(reportMonthOf(dto.to, asOfDate)),
      this.debtsExport.resolveBranchLabel(branchId),
    ]);

    onProgress(85, total, 'Đang tạo file Excel...');
    const buffer = await buildGaragePeriodReport({
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
    });

    onProgress(100, total, 'Hoàn tất.');
    return buffer;
  }
}
