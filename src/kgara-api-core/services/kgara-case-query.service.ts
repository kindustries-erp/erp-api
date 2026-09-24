import { Injectable } from '@nestjs/common';
import { SelectQueryBuilder } from 'typeorm';
import { KgaraCase } from '../entities/kgara_case.entity';
import { KgaraCaseService } from '../entities/kgara_case_service.entity';
import {
  getCaseColumnSelectExpr,
  applySingleCaseColumnFilter,
  applyCaseOptionFilters,
  applyCaseListFilters,
  getCaseServiceColumnSelectExpr,
  applySingleCaseServiceColumnFilter,
  applyCaseServiceFilters,
} from '../helpers/kgara-case-filter.helper';
import { KgaraCaseSettlementCalcService } from './kgara-case-settlement-calc.service';
import { KgaraCaseServicesQueryService } from './kgara-case-services-query.service';
import {
  KgaraCaseExportService,
  CompletedCasesExportParams,
} from './kgara-case-export.service';

export type { CompletedCasesExportParams };

/**
 * Facade Service cho toàn bộ truy vấn, báo cáo và xuất Excel của KGara Cases
 */
@Injectable()
export class KgaraCaseQueryService {
  constructor(
    private readonly settlementCalcService: KgaraCaseSettlementCalcService,
    private readonly caseServicesQueryService: KgaraCaseServicesQueryService,
    private readonly exportService: KgaraCaseExportService,
  ) {}

  // ──────────────────────────────────────────────────────────────────────────
  // CASE FILTERS & QUERY HELPERS (Delegated to Pure Helper)
  // ──────────────────────────────────────────────────────────────────────────

  getCaseColumnSelectExpr(column: string): string | null {
    return getCaseColumnSelectExpr(column);
  }

  applySingleCaseColumnFilter(
    qb: SelectQueryBuilder<KgaraCase>,
    column: string,
    values: string[],
    paramPrefix: string,
  ): void {
    applySingleCaseColumnFilter(qb, column, values, paramPrefix);
  }

  applyCaseOptionFilters(
    qb: SelectQueryBuilder<KgaraCase>,
    activeColumn: string,
    filtersStr?: string,
  ): void {
    applyCaseOptionFilters(qb, activeColumn, filtersStr);
  }

  applyCaseListFilters(
    qb: SelectQueryBuilder<KgaraCase>,
    filtersStr?: string,
  ): void {
    applyCaseListFilters(qb, filtersStr);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SETTLEMENT CALCULATION
  // ──────────────────────────────────────────────────────────────────────────

  async recalculateCaseSettlementSummary(caseId: string): Promise<void> {
    return this.settlementCalcService.recalculateCaseSettlementSummary(caseId);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CASE SERVICES (CHI TIẾT DÒNG DỊCH VỤ & PHỤ TÙNG)
  // ──────────────────────────────────────────────────────────────────────────

  getCaseServiceColumnSelectExpr(column: string): string | null {
    return getCaseServiceColumnSelectExpr(column);
  }

  applySingleCaseServiceColumnFilter(
    qb: SelectQueryBuilder<KgaraCaseService>,
    column: string,
    values: string[],
    paramPrefix: string,
  ): void {
    applySingleCaseServiceColumnFilter(qb, column, values, paramPrefix);
  }

  applyCaseServiceFilters(
    qb: SelectQueryBuilder<KgaraCaseService>,
    filtersStr?: string,
    prefix: string = 'list_',
  ): void {
    applyCaseServiceFilters(qb, filtersStr, prefix);
  }

  async findCaseServices(params: {
    branchId?: string;
    page?: number | string;
    pageSize?: number | string;
    q?: string;
    from?: string;
    to?: string;
    serviceType?: string;
    filtersStr?: string;
    sorts?: string | string[];
  }) {
    return this.caseServicesQueryService.findCaseServices(params);
  }

  async getCaseServiceColumnOptions(
    branchId: string,
    column: string,
    search: string = '',
    page: number = 1,
    pageSize: number = 20,
    filtersStr?: string,
    serviceType?: string,
    date_from?: string,
    date_to?: string,
    date_type?: 'completion_date' | 'case_date',
    classification?: string,
    status?: string,
  ) {
    return this.caseServicesQueryService.getCaseServiceColumnOptions(
      branchId,
      column,
      search,
      page,
      pageSize,
      filtersStr,
      serviceType,
      date_from,
      date_to,
      date_type,
      classification,
      status,
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // EXCEL EXPORTS
  // ──────────────────────────────────────────────────────────────────────────

  async exportCompletedCasesExcel(
    params: CompletedCasesExportParams,
  ): Promise<Buffer> {
    return this.exportService.exportCompletedCasesExcel(params);
  }

  async exportCaseServicesExcel(params: {
    branchId?: string;
    q?: string;
    from?: string;
    to?: string;
    serviceType?: string;
    filtersStr?: string;
    sorts?: string | string[];
  }): Promise<Buffer> {
    return this.exportService.exportCaseServicesExcel(params);
  }
}
