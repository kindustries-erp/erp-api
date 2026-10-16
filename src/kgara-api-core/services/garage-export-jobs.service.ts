import { Injectable, OnModuleDestroy } from '@nestjs/common';

import {
  ExportJobRunner,
  formatExportTimestamp,
  stableStringify,
  type ExportStartResult,
} from '../../common/export-jobs/export-job-runner';
import type {
  GarageCasesExportDto,
  GarageDashboardExportDto,
  GarageDebtsExportDto,
} from '../dto/garage-export.dto';
import {
  buildGarageDebtFileName,
  type GarageDebtExportKind,
} from '../helpers/garage-debts-export.helper';
import { buildGarageCaseExportFileName } from '../helpers/kgara-excel-style.helper';
import { GarageDebtsExportService } from './garage-debts-export.service';
import { GaragePeriodReportService } from './garage-period-report.service';
import { KgaraCompletedCasesExportService } from './kgara-completed-cases-export.service';

/** Công nợ đổi theo ngày/đồng bộ nên chỉ tái dùng file vừa tạo trong 10 phút. */
const REUSE_WINDOW_MS = 10 * 60 * 1000;
const PROGRESS_TOTAL_UNITS = 100;

export const GARAGE_CASES_EXPORT_PROCESS_ID = 'garage-cases-xlsx-export';
export const GARAGE_DASHBOARD_EXPORT_PROCESS_ID =
  'garage-dashboard-xlsx-export';
export const GARAGE_DEBTS_EXPORT_PROCESS_IDS: Record<
  GarageDebtExportKind,
  string
> = {
  all: 'garage-all-debts-xlsx-export',
  customers: 'garage-customers-debt-xlsx-export',
  suppliers: 'garage-suppliers-debt-xlsx-export',
};

/**
 * Giữ các runner xuất nền của Garage (job in-memory, mỗi user 1 job RUNNING
 * trên mỗi runner). Fingerprint luôn gồm `branchId` để không dùng nhầm file
 * giữa các chi nhánh.
 */
@Injectable()
export class GarageExportJobsService implements OnModuleDestroy {
  readonly casesRunner = new ExportJobRunner({
    processId: GARAGE_CASES_EXPORT_PROCESS_ID,
    reuseWindowMs: REUSE_WINDOW_MS,
  });

  readonly dashboardRunner = new ExportJobRunner({
    processId: GARAGE_DASHBOARD_EXPORT_PROCESS_ID,
    reuseWindowMs: REUSE_WINDOW_MS,
  });

  private readonly debtRunners: Record<GarageDebtExportKind, ExportJobRunner> =
    {
      all: new ExportJobRunner({
        processId: GARAGE_DEBTS_EXPORT_PROCESS_IDS.all,
        reuseWindowMs: REUSE_WINDOW_MS,
      }),
      customers: new ExportJobRunner({
        processId: GARAGE_DEBTS_EXPORT_PROCESS_IDS.customers,
        reuseWindowMs: REUSE_WINDOW_MS,
      }),
      suppliers: new ExportJobRunner({
        processId: GARAGE_DEBTS_EXPORT_PROCESS_IDS.suppliers,
        reuseWindowMs: REUSE_WINDOW_MS,
      }),
    };

  constructor(
    private readonly casesExportService: KgaraCompletedCasesExportService,
    private readonly debtsExportService: GarageDebtsExportService,
    private readonly periodReportService: GaragePeriodReportService,
  ) {}

  onModuleDestroy() {
    this.casesRunner.destroy();
    this.dashboardRunner.destroy();
    Object.values(this.debtRunners).forEach((runner) => runner.destroy());
  }

  debtsRunner(kind: GarageDebtExportKind): ExportJobRunner {
    return this.debtRunners[kind];
  }

  startCasesExport(
    dto: GarageCasesExportDto,
    branchId: string | undefined,
    userId: string,
  ): ExportStartResult {
    const byCurrentFilter = dto.mode === 'by-current-filter';
    const timestamp = formatExportTimestamp(new Date());
    const fileName = byCurrentFilter
      ? `Bang_ke_phieu_dich_vu_theo_bo_loc_${timestamp}.xlsx`
      : buildGarageCaseExportFileName(dto.classification, dto.status);

    return this.casesRunner.start({
      userId,
      fingerprint: stableStringify({ branchId: branchId ?? '', ...dto }),
      fileName,
      totalUnits: PROGRESS_TOTAL_UNITS,
      dateFrom: dto.date_from,
      dateTo: dto.date_to,
      producer: async (onProgress) => {
        onProgress(5, PROGRESS_TOTAL_UNITS, 'Đang truy vấn phiếu dịch vụ...');
        const buffer = await this.casesExportService.exportCompletedCasesExcel({
          ...dto,
          branchId,
        });
        onProgress(95, PROGRESS_TOTAL_UNITS, 'Đang đóng gói file Excel...');
        return buffer;
      },
    });
  }

  startDebtsExport(
    kind: GarageDebtExportKind,
    dto: GarageDebtsExportDto,
    branchId: string | undefined,
    userId: string,
  ): ExportStartResult {
    const filters = this.debtsExportService.normalizeFilters(dto);

    return this.debtRunners[kind].start({
      userId,
      fingerprint: stableStringify({
        kind,
        branchId: branchId ?? '',
        ...filters,
      }),
      fileName: buildGarageDebtFileName(
        kind,
        formatExportTimestamp(new Date()),
      ),
      totalUnits: GarageDebtsExportService.PROGRESS_TOTAL_UNITS,
      dateFrom: dto.from,
      dateTo: dto.to,
      producer: (onProgress) =>
        this.debtsExportService.exportExcel(
          kind,
          branchId ?? '',
          dto,
          onProgress,
        ),
    });
  }

  /** Báo cáo Garage theo kỳ (tab Tổng quan). Fingerprint gồm chi nhánh và khoảng ngày. */
  startDashboardExport(
    dto: GarageDashboardExportDto,
    branchId: string | undefined,
    userId: string,
  ): ExportStartResult {
    const timestamp = formatExportTimestamp(new Date());
    const compact = (day?: string) =>
      day ? day.slice(0, 10).replace(/-/g, '') : '';
    const period =
      dto.from || dto.to ? `${compact(dto.from)}-${compact(dto.to)}_` : '';

    return this.dashboardRunner.start({
      userId,
      fingerprint: stableStringify({ branchId: branchId ?? '', ...dto }),
      fileName: `Bao_cao_Garage_${period}${timestamp}.xlsx`,
      totalUnits: GaragePeriodReportService.PROGRESS_TOTAL_UNITS,
      dateFrom: dto.from,
      dateTo: dto.to,
      producer: (onProgress) =>
        this.periodReportService.exportExcel(branchId ?? '', dto, onProgress),
    });
  }
}
