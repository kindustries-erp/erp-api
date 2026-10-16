import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { ExportProgressReporter } from '../../common/export-jobs/export-job-runner';
import type { GarageDebtsExportDto } from '../dto/garage-export.dto';
import { KgaraBranch } from '../entities/kgara_branch.entity';
import {
  buildGarageDebtReport,
  buildGarageAllDebtsReport,
  convertReceivablesBreakdownToExportSections,
  convertReceivablesBreakdownToGroupSummary,
  type GarageDebtExportKind,
  type GarageDebtExportRow,
  type GarageDebtGroupExportSection,
  type GarageDebtGroupSummaryItem,
} from '../helpers/garage-debts-export.helper';
import { KgaraCustomersDebtQueryService } from './kgara-customers-debt-query.service';
import { KgaraSuppliersService } from './kgara-suppliers.service';
import { GarageMonthlyReceivablesBreakdownService } from './garage-monthly-receivables-breakdown.service';

/** Lấy toàn bộ tập lọc, không phân trang (engine NCC không giới hạn pageSize). */
const ALL_ROWS_PAGE_SIZE = '1000000';

@Injectable()
export class GarageDebtsExportService {
  static readonly PROGRESS_TOTAL_UNITS = 100;

  constructor(
    private readonly customersDebtQueryService: KgaraCustomersDebtQueryService,
    private readonly suppliersService: KgaraSuppliersService,
    @Optional()
    @InjectRepository(KgaraBranch)
    private readonly branchRepo?: Repository<KgaraBranch>,
    @Optional()
    private readonly receivablesBreakdownService?: GarageMonthlyReceivablesBreakdownService,
  ) {}

  /**
   * `by-period` chỉ giữ kỳ (from/to); `by-current-filter` giữ thêm q, sorts và
   * mọi filter/search cột của bảng đang xem.
   */
  normalizeFilters(dto: GarageDebtsExportDto): GarageDebtsExportDto {
    if (dto.mode === 'by-current-filter') return dto;
    return { mode: dto.mode, from: dto.from, to: dto.to };
  }

  async exportExcel(
    kind: GarageDebtExportKind,
    branchId: string,
    dto: GarageDebtsExportDto,
    onProgress: ExportProgressReporter = () => undefined,
  ): Promise<Buffer> {
    const total = GarageDebtsExportService.PROGRESS_TOTAL_UNITS;
    const filters = this.normalizeFilters(dto);

    onProgress(5, total, 'Đang truy vấn công nợ...');

    // Nạp dữ liệu phân loại nhóm và danh sách từng phiếu dịch vụ nếu có breakdown service
    let customerSections: GarageDebtGroupExportSection[] | undefined;
    let customerGroupsSummary: GarageDebtGroupSummaryItem[] | undefined;

    if (
      (kind === 'customers' || kind === 'all') &&
      this.receivablesBreakdownService
    ) {
      try {
        const breakdown =
          await this.receivablesBreakdownService.getMonthlyReceivablesBreakdown(
            undefined,
            branchId,
            undefined,
            filters.from,
            filters.to,
          );
        customerSections =
          convertReceivablesBreakdownToExportSections(breakdown);
        customerGroupsSummary =
          convertReceivablesBreakdownToGroupSummary(breakdown);
      } catch {
        // Fallback an toàn nếu phân tách breakdown gặp lỗi
      }
    }

    if (kind === 'all') {
      const [customerRows, supplierRows] = await Promise.all([
        this.loadCustomerRows(branchId, filters),
        this.loadSupplierRows(branchId, filters),
      ]);

      const payableGroupsSummary: GarageDebtGroupSummaryItem[] =
        supplierRows.length > 0
          ? [
              {
                groupName: 'Chi phí dịch vụ & Phụ tùng / NCC',
                partnerCount: supplierRows.length,
                caseCount: supplierRows.reduce(
                  (acc, r) => acc + (r.caseCount || 0),
                  0,
                ),
                billed: supplierRows.reduce(
                  (acc, r) => acc + (r.totalAmount || 0),
                  0,
                ),
                paid: supplierRows.reduce(
                  (acc, r) => acc + (r.paidAmount || 0),
                  0,
                ),
                remaining: supplierRows.reduce(
                  (acc, r) => acc + (r.balanceAmount || 0),
                  0,
                ),
                rate:
                  supplierRows.reduce(
                    (acc, r) => acc + (r.totalAmount || 0),
                    0,
                  ) > 0
                    ? supplierRows.reduce(
                        (acc, r) => acc + (r.paidAmount || 0),
                        0,
                      ) /
                      supplierRows.reduce(
                        (acc, r) => acc + (r.totalAmount || 0),
                        0,
                      )
                    : 0,
              },
            ]
          : [];

      onProgress(
        55,
        total,
        `Đang tạo Dashboard và file Excel (${customerRows.length + supplierRows.length} đối tác)...`,
      );
      const branchLabel = await this.resolveBranchLabel(branchId);
      const buffer = await buildGarageAllDebtsReport(
        customerRows,
        supplierRows,
        {
          dateFrom: filters.from,
          dateTo: filters.to,
          branchLabel,
          modeLabel:
            dto.mode === 'by-current-filter'
              ? 'Theo filter hiện tại của bảng'
              : 'Theo kỳ',
          customerGroupsSummary,
          payableGroupsSummary,
        },
        customerSections,
      );

      onProgress(100, total, 'Hoàn tất.');
      return buffer;
    }

    const rows =
      kind === 'customers'
        ? await this.loadCustomerRows(branchId, filters)
        : await this.loadSupplierRows(branchId, filters);

    onProgress(
      55,
      total,
      `Đang tạo Dashboard và file Excel (${rows.length} đối tác)...`,
    );
    const branchLabel = await this.resolveBranchLabel(branchId);
    const buffer = await buildGarageDebtReport(
      kind,
      rows,
      {
        dateFrom: filters.from,
        dateTo: filters.to,
        branchLabel,
        modeLabel:
          dto.mode === 'by-current-filter'
            ? 'Theo filter hiện tại của bảng'
            : 'Theo kỳ',
        customerGroupsSummary:
          kind === 'customers' ? customerGroupsSummary : undefined,
      },
      kind === 'customers' ? customerSections : undefined,
    );

    onProgress(100, total, 'Hoàn tất.');
    return buffer;
  }

  private async resolveBranchLabel(
    branchId: string,
  ): Promise<string | undefined> {
    if (!branchId) return undefined;
    try {
      const branch = await this.branchRepo?.findOne({
        where: { externalId: branchId },
      });
      return branch?.name || branchId;
    } catch {
      return branchId;
    }
  }

  private async loadCustomerRows(
    branchId: string,
    filters: GarageDebtsExportDto,
  ): Promise<GarageDebtExportRow[]> {
    const result = await this.customersDebtQueryService.getCustomersDebt(
      branchId,
      {
        q: filters.q,
        from: filters.from,
        to: filters.to,
        sorts: filters.sorts,
        filtersStr: filters.filtersStr,
        columnFiltersParam: filters.column_filters,
        columnSearchParam: filters.column_search,
      },
      { unpaged: true },
    );

    return result.data.map((r: any) => ({
      licensePlate: r.licensePlate,
      partnerCode: r.customerCode,
      partnerName: r.customerName,
      caseCount: r.caseCount,
      totalAmount: r.totalAmount,
      paidAmount: r.paidAmount,
      balanceAmount: r.balanceAmount,
      aging0_30: r.aging0_30,
      aging31_60: r.aging31_60,
      aging61_90: r.aging61_90,
      agingOver90: r.agingOver90,
      maxAgingDays: r.maxAgingDays,
      latestDate: r.latestDate,
      oldestDate: r.oldestDate,
    }));
  }

  private async loadSupplierRows(
    branchId: string,
    filters: GarageDebtsExportDto,
  ): Promise<GarageDebtExportRow[]> {
    const result = await this.suppliersService.getSuppliersDebt({
      branchId,
      page: '1',
      pageSize: ALL_ROWS_PAGE_SIZE,
      q: filters.q ?? '',
      from: filters.from,
      to: filters.to,
      sorts: filters.sorts,
      filtersStr: filters.filtersStr,
      column_filters: filters.column_filters,
      column_search: filters.column_search,
    });

    return result.data.map((r) => ({
      licensePlate: r.licensePlate,
      partnerCode: r.supplierCode,
      partnerName: r.supplierName,
      caseCount: r.caseCount,
      totalAmount: r.costAmount,
      paidAmount: r.paidAmount,
      balanceAmount: r.balanceAmount,
      aging0_30: r.aging0_30,
      aging31_60: r.aging31_60,
      aging61_90: r.aging61_90,
      agingOver90: r.agingOver90,
      maxAgingDays: r.maxAgingDays,
      latestDate: r.latestDate,
      oldestDate: r.oldestDate,
    }));
  }
}
