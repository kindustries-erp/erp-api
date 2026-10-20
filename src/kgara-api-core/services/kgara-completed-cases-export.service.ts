import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { KgaraCase } from '../entities/kgara_case.entity';
import { KgaraCaseSettlement } from '../entities/kgara_case_settlement.entity';
import { KgaraCaseService } from '../entities/kgara_case_service.entity';
import { KgaraBranch } from '../entities/kgara_branch.entity';
import { KgaraGrossProfit } from '../entities/kgara_gross_profit.entity';
import { KgaraCaseLinkedInvoice } from '../entities/kgara_case_linked_invoice.entity';
import { GarageHubService } from '../hub/garage-hub.service';
import { applyCaseListFilters } from '../helpers/kgara-case-filter.helper';
import { applyCaseListSorts } from '../helpers/kgara-case-sort.helper';
import { createDashboardSheet } from '../../common/xlsx-charts/dashboard-sheet.helper';
import { injectCharts } from '../../common/xlsx-charts/xlsx-chart-injector';
import {
  CASES_DASHBOARD_SHEET,
  buildCasesDashboard,
} from '../helpers/garage-cases-dashboard.builder';
import type { DateBasis } from '../helpers/garage-cases-dashboard-data.helper';
import {
  buildSheet1CompletedCases,
  buildSheet2PnlTracking,
  buildSheet3ItemizedServices,
} from '../helpers/kgara-completed-cases-sheet.builder';

export interface CompletedCasesExportParams {
  branchId?: string;
  date_from?: string;
  date_to?: string;
  date_type?: 'completion_date' | 'case_date';
  classification?: string;
  status?: string;
  q?: string;
  /**
   * `by-current-filter`: bám bảng đang xem (kỳ theo ngày phát sinh, filter cột,
   * sort, mọi trạng thái). Mặc định `by-period`: bảng kê phiếu kết thúc theo kỳ.
   */
  mode?: 'by-period' | 'by-current-filter';
  filtersStr?: string;
  sorts?: string | string[];
  /** Key cột Sheet 1 cần xuất; bỏ trống = toàn bộ cột. */
  selectedColumns?: string[];
}

@Injectable()
export class KgaraCompletedCasesExportService {
  private readonly logger = new Logger(KgaraCompletedCasesExportService.name);

  constructor(
    @InjectRepository(KgaraCase)
    private readonly caseRepo: Repository<KgaraCase>,
    @InjectRepository(KgaraCaseSettlement)
    private readonly settlementRepo: Repository<KgaraCaseSettlement>,
    private readonly hub: GarageHubService,
    @Optional()
    @InjectRepository(KgaraCaseService)
    private readonly serviceRepo?: Repository<KgaraCaseService>,
    @Optional()
    @InjectRepository(KgaraBranch)
    private readonly branchRepo?: Repository<KgaraBranch>,
    @Optional()
    @InjectRepository(KgaraGrossProfit)
    private readonly grossProfitRepo?: Repository<KgaraGrossProfit>,
    @Optional()
    @InjectRepository(KgaraCaseLinkedInvoice)
    private readonly linkedInvoiceRepo?: Repository<KgaraCaseLinkedInvoice>,
  ) {}

  async exportCompletedCasesExcel(
    params: CompletedCasesExportParams,
  ): Promise<Buffer> {
    const cases = await this.queryCompletedCases(params);
    const caseDbIds = cases.map((c) => c.id).filter(Boolean);
    const hdIds = cases.map((c) => c.hdPhieuDichVuId).filter(Boolean);

    const [
      branchNameMap,
      linkedInvoiceSummaryMap,
      linkedInvoiceVatMap,
      serviceLinesMap,
      settlementsMap,
      caseLedgerMap,
    ] = await Promise.all([
      this.getBranchNameMap(),
      this.getLinkedInvoiceSummaryMap(caseDbIds),
      this.getLinkedInvoiceVatMap(caseDbIds),
      this.getServiceLinesMap(hdIds, cases),
      this.getSettlementsMap(caseDbIds),
      this.hub.getCaseLedger(caseDbIds),
    ]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Liouni ERP';
    workbook.lastModifiedBy = 'Liouni ERP';
    workbook.created = new Date();

    // Dashboard tạo đầu tiên để nằm đầu file; điền sau khi có số liệu Sheet 1.
    const dashboard = createDashboardSheet(workbook, CASES_DASHBOARD_SHEET);

    const sheet1 = buildSheet1CompletedCases(
      workbook,
      cases,
      branchNameMap,
      linkedInvoiceSummaryMap,
      settlementsMap,
      serviceLinesMap,
      caseLedgerMap,
      params.selectedColumns,
      linkedInvoiceVatMap,
    );

    buildSheet2PnlTracking(workbook, cases, branchNameMap, serviceLinesMap);

    buildSheet3ItemizedServices(workbook, cases, serviceLinesMap);

    const charts = buildCasesDashboard(dashboard, sheet1, {
      dateFrom: params.date_from,
      dateTo: params.date_to,
      branchLabel: params.branchId
        ? branchNameMap[params.branchId] || params.branchId
        : undefined,
      modeLabel:
        params.mode === 'by-current-filter'
          ? 'Theo filter hiện tại của bảng'
          : 'Theo kỳ',
      dateBasis: this.resolveDateBasis(params),
    });

    const uint8Array = await workbook.xlsx.writeBuffer();
    return injectCharts(Buffer.from(uint8Array), CASES_DASHBOARD_SHEET, charts);
  }

  /** Cùng cơ sở ngày với điều kiện lọc kỳ để biểu đồ theo thời gian khớp bộ lọc. */
  private resolveDateBasis(params: CompletedCasesExportParams): DateBasis {
    if (params.mode === 'by-current-filter') return 'issued';
    return params.date_type === 'case_date' ? 'received' : 'completion';
  }

  private async queryCompletedCases(
    params: CompletedCasesExportParams,
  ): Promise<any[]> {
    const qb = this.caseRepo
      .createQueryBuilder('case')
      .leftJoinAndMapOne(
        'case.grossProfit',
        KgaraGrossProfit,
        'gp',
        'gp.hdPhieuDichVuId = case.hdPhieuDichVuId OR gp.vuViecCode = case.soChungTu',
      )
      .where('case.kgaraDeletedAt IS NULL');

    const byCurrentFilter = params.mode === 'by-current-filter';

    if (
      !byCurrentFilter &&
      (!params.status || params.status.toLowerCase() !== 'all')
    ) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('case.tinhTrangDichVu = 3')
            .orWhere('case.tenTinhTrangDichVu ILIKE :kwHoanTat', {
              kwHoanTat: '%hoàn tất%',
            })
            .orWhere('case.tenTinhTrangDichVu ILIKE :kwKetThuc', {
              kwKetThuc: '%kết thúc%',
            })
            .orWhere('case.ngayHoanThanhCongViec IS NOT NULL');
        }),
      ).andWhere('(case.tinhTrangDichVu IS NULL OR case.tinhTrangDichVu != 9)');
    }

    const dateType = params.date_type || 'completion_date';
    const dateField = byCurrentFilter
      ? 'case.ngayPhatSinh'
      : dateType === 'case_date'
        ? 'COALESCE(case.ngayTiepNhan, case.ngayPhatSinh)'
        : 'case.ngayHoanThanhCongViec';

    if (params.date_from) {
      const fromDate = params.date_from.includes('T')
        ? params.date_from
        : `${params.date_from} 00:00:00`;
      qb.andWhere(`${dateField} >= :fromDate`, { fromDate });
    }
    if (params.date_to) {
      const toDate = params.date_to.includes('T')
        ? params.date_to
        : `${params.date_to} 23:59:59.999`;
      qb.andWhere(`${dateField} <= :toDate`, { toDate });
    }

    if (params.branchId) {
      qb.andWhere('case.branchExternalId = :branchId', {
        branchId: params.branchId,
      });
    }
    if (!byCurrentFilter && params.classification) {
      qb.andWhere('case.classification = :classification', {
        classification: params.classification,
      });
    }
    if (params.q) {
      const qClean = params.q.replace(/[,.]/g, '');
      const qNumber = Number(qClean);
      // Khớp số tiền chỉ áp dụng khi bám bảng đang xem (giống ô tìm kiếm của bảng).
      const matchAmount =
        byCurrentFilter && !isNaN(qNumber) && qNumber > 0 && qClean.length > 0;
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('case.soChungTu ILIKE :q', { q: `%${params.q}%` })
            .orWhere('case.bienSoXe ILIKE :q', { q: `%${params.q}%` })
            .orWhere('case.khachHangName ILIKE :q', { q: `%${params.q}%` })
            .orWhere('case.khachHangCode ILIKE :q', { q: `%${params.q}%` });
          if (matchAmount) {
            sub
              .orWhere('case.tienCoThue = :qNum', { qNum: qNumber })
              .orWhere('case.chiPhi = :qNum', { qNum: qNumber });
          }
        }),
      );
    }

    if (byCurrentFilter) {
      applyCaseListFilters(qb, params.filtersStr);
      if (params.sorts && params.sorts.length > 0) {
        applyCaseListSorts(qb, params.sorts);
        return qb.getMany();
      }
    }

    qb.orderBy('case.ngayHoanThanhCongViec', 'DESC', 'NULLS LAST')
      .addOrderBy('case.ngayPhatSinh', 'DESC', 'NULLS LAST')
      .addOrderBy('case.soChungTu', 'DESC');

    return qb.getMany();
  }

  private async getBranchNameMap(): Promise<Record<string, string>> {
    if (!this.branchRepo) return {};
    try {
      const branches = await this.branchRepo.find();
      return branches.reduce(
        (acc, b) => {
          if (b.externalId)
            acc[b.externalId] = b.name || b.code || b.externalId;
          return acc;
        },
        {} as Record<string, string>,
      );
    } catch (err) {
      this.logger.warn(`Failed to query branches: ${err}`);
      return {};
    }
  }

  private async getLinkedInvoiceSummaryMap(
    caseDbIds: string[],
  ): Promise<Record<string, string>> {
    if (!this.linkedInvoiceRepo || caseDbIds.length === 0) return {};
    const map: Record<string, string> = {};
    try {
      const rows = await this.linkedInvoiceRepo
        .createQueryBuilder('l')
        .leftJoin('erp_invoices', 'inv', 'inv.id = l.invoiceId')
        .select('l.caseDbId', 'caseDbId')
        .addSelect(
          "STRING_AGG(DISTINCT COALESCE(inv.invoice_no, CAST(l.invoiceId AS text)), ', ')",
          'invoiceNos',
        )
        .where('l.caseDbId IN (:...caseDbIds)', { caseDbIds })
        .groupBy('l.caseDbId')
        .getRawMany();
      for (const r of rows) {
        if (r.caseDbId && r.invoiceNos) map[r.caseDbId] = r.invoiceNos;
      }
    } catch (err) {
      this.logger.warn(`Failed to aggregate linked invoices: ${err}`);
    }
    return map;
  }

  /**
   * Thuế GTGT theo phiếu = tổng `vat_amount` các hóa đơn đầu ra liên kết (chưa xóa).
   * Phiếu có hóa đơn dùng chung với phiếu khác không đưa vào map để không cộng đôi;
   * builder sẽ dùng nguồn dự phòng cho các phiếu đó.
   */
  private async getLinkedInvoiceVatMap(
    caseDbIds: string[],
  ): Promise<Record<string, number>> {
    if (!this.linkedInvoiceRepo || caseDbIds.length === 0) return {};
    try {
      const rows: {
        caseDbId: string;
        invoiceId: string;
        vatAmount: string | null;
        sharedCaseCount: string;
      }[] = await this.linkedInvoiceRepo
        .createQueryBuilder('l')
        .innerJoin('erp_invoices', 'inv', 'inv.id = l.invoiceId')
        .select('l.caseDbId', 'caseDbId')
        .addSelect('l.invoiceId', 'invoiceId')
        .addSelect('inv.vat_amount', 'vatAmount')
        .addSelect(
          `(SELECT COUNT(DISTINCT s."caseDbId") FROM kgara_case_linked_invoice s WHERE s."invoiceId" = l."invoiceId" AND s."linkType" = 'OUT')`,
          'sharedCaseCount',
        )
        .where("l.linkType = 'OUT'")
        .andWhere('inv.is_deleted = false')
        .andWhere('l.caseDbId IN (:...caseDbIds)', { caseDbIds })
        .getRawMany();

      const excluded = new Set<string>();
      const perCase = new Map<string, Map<string, number>>();
      for (const r of rows) {
        if (!r.caseDbId || r.vatAmount == null) continue;
        if (Number(r.sharedCaseCount) > 1) {
          excluded.add(r.caseDbId);
          continue;
        }
        const invoices = perCase.get(r.caseDbId) ?? new Map<string, number>();
        invoices.set(r.invoiceId, Number(r.vatAmount ?? 0));
        perCase.set(r.caseDbId, invoices);
      }

      const map: Record<string, number> = {};
      for (const [caseDbId, invoices] of perCase) {
        if (excluded.has(caseDbId)) continue;
        map[caseDbId] = [...invoices.values()].reduce((a, b) => a + b, 0);
      }
      return map;
    } catch (err) {
      this.logger.warn(`Failed to aggregate linked invoice VAT: ${err}`);
      return {};
    }
  }

  private async getServiceLinesMap(
    hdIds: string[],
    cases: any[],
  ): Promise<Map<string, any[]>> {
    const map = new Map<string, any[]>();
    if (this.serviceRepo && hdIds.length > 0) {
      try {
        const chunkSize = 2000;
        for (let i = 0; i < hdIds.length; i += chunkSize) {
          const chunk = hdIds.slice(i, i + chunkSize);
          const dbLines = await this.serviceRepo
            .createQueryBuilder('line')
            .where('line.hdPhieuDichVuId IN (:...chunk)', { chunk })
            .orderBy('line.hdPhieuDichVuId', 'ASC')
            .addOrderBy('line.createdAt', 'ASC')
            .getMany();
          for (const line of dbLines) {
            if (line.hdPhieuDichVuId) {
              const list = map.get(line.hdPhieuDichVuId) || [];
              list.push(line);
              map.set(line.hdPhieuDichVuId, list);
            }
          }
        }
      } catch (err) {
        this.logger.warn(`Failed to query service lines: ${err}`);
      }
    }
    for (const c of cases) {
      if (!c.hdPhieuDichVuId || map.has(c.hdPhieuDichVuId)) continue;
      const rawList =
        c.rawData?.ListPhieuDichVuChiTiet ||
        c.rawData?.HoaDonChiTiet ||
        c.rawData?.PhieuDichVuChiTiet;
      if (Array.isArray(rawList) && rawList.length > 0)
        map.set(c.hdPhieuDichVuId, rawList);
    }
    return map;
  }

  private async getSettlementsMap(
    caseDbIds: string[],
  ): Promise<Record<string, { receipts: number; payments: number }>> {
    const map: Record<string, { receipts: number; payments: number }> = {};
    if (caseDbIds.length === 0) return map;
    try {
      const chunkSize = 2000;
      for (let i = 0; i < caseDbIds.length; i += chunkSize) {
        const chunk = caseDbIds.slice(i, i + chunkSize);
        const rows = await this.settlementRepo
          .createQueryBuilder('s')
          .select('s.caseId', 'caseId')
          .addSelect('s.settlementType', 'settlementType')
          .addSelect('SUM(s.amount)', 'totalAmount')
          .where('s.caseId IN (:...chunk)', { chunk })
          .groupBy('s.caseId')
          .addGroupBy('s.settlementType')
          .getRawMany();
        for (const r of rows) {
          if (!map[r.caseId]) map[r.caseId] = { receipts: 0, payments: 0 };
          if (r.settlementType === 'RECEIPT')
            map[r.caseId].receipts += Number(r.totalAmount || 0);
          else if (r.settlementType === 'PAYMENT')
            map[r.caseId].payments += Number(r.totalAmount || 0);
        }
      }
    } catch (err) {
      this.logger.warn(`Failed to query case settlements: ${err}`);
    }
    return map;
  }
}
