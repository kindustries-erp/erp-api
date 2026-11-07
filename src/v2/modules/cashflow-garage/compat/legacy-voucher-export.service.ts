import { Injectable } from '@nestjs/common';
import { DataSource, In, SelectQueryBuilder } from 'typeorm';
import { applyMultiKeywordFilter } from '@/common/utils/query-builder.util';
import type { ExportProgressReporter } from '@/common/export-jobs/export-job-runner';
import { KgaraCase } from '@/kgara-api-core/entities/kgara_case.entity';
import type { GarageCashflowExportDto } from '@/kgara-api-core/dto/garage-cashflow-export.dto';
import type { KgaraCashflowVoucherResponseDto } from '@/kgara-api-core/dto/garage-cashflow.dto';
import { GarageCashflowExcelBuilder } from '@/kgara-api-core/services/garage-cashflow-excel.builder';
import { CashflowForecast } from '@/v2/core/cashflow-core';
import { CashflowGarageForecastExt } from '../entities/cashflow-garage-forecast-ext.entity';
import {
  applyLegacyColumnFilters,
  applyLegacyColumnSearch,
  paymentStatusCondition,
  toDirection,
} from './legacy-voucher-list.filters';
import { toLegacyVoucherResponse } from './legacy-voucher.mapper';

type Qb = SelectQueryBuilder<CashflowForecast>;

/** Ngày đầu/cuối của kỳ theo tuần, tháng, quý (giống engine cũ), trả về cặp [từ, đến]. */
export function resolvePeriodRange(dto: GarageCashflowExportDto): {
  from?: string;
  to?: string;
} {
  let from = dto.dateFrom || dto.startDate;
  let to = dto.dateTo || dto.endDate;

  if (dto.periodType === 'week' && dto.week?.includes('_')) {
    const [wFrom, wTo] = dto.week.split('_');
    if (wFrom) from = wFrom;
    if (wTo) to = wTo;
  } else if (dto.periodType === 'month' && dto.period) {
    const [y, m] = dto.period.split('-').map(Number);
    if (y && m) {
      from = new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 10);
      to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    }
  } else if (dto.periodType === 'quarter' && dto.quarter) {
    const [yStr, qStr] = dto.quarter.split('-Q');
    const y = Number(yStr);
    const q = Number(qStr);
    if (y && q >= 1 && q <= 4) {
      const startMonth = (q - 1) * 3;
      from = new Date(Date.UTC(y, startMonth, 1)).toISOString().slice(0, 10);
      to = new Date(Date.UTC(y, startMonth + 3, 0)).toISOString().slice(0, 10);
    }
  }
  return { from, to };
}

/** Sắp xếp theo `sorts` của export (khác danh sách: có thu/chi/trạng thái). Mặc định ngày giảm dần. */
function applyExportSorts(qb: Qb, sorts?: string[]): void {
  const SORT_SQL: Record<string, string> = {
    transDate: 'f.planned_date',
    voucherCode: 'f.code',
    thu: 'f.amount',
    chi: 'f.amount',
    createdAt: 'f.created_at',
    licensePlate: 'COALESCE(ext.license_plate, kc.bien_so_xe)',
    partnerName: 'COALESCE(f.partner_name, kc.khach_hang_name)',
  };
  if (!sorts || sorts.length === 0) {
    qb.orderBy('f.plannedDate', 'DESC').addOrderBy('f.createdAt', 'DESC');
    return;
  }
  let first = true;
  for (const item of sorts) {
    const desc = item.startsWith('-');
    const col = desc ? item.slice(1) : item;
    const dir = desc ? 'DESC' : 'ASC';
    const expr = SORT_SQL[col] ?? 'f.planned_date';
    if (first) qb.orderBy(expr, dir);
    else qb.addOrderBy(expr, dir);
    first = false;
  }
}

/**
 * Xuất Excel thu chi garage theo hình dạng cũ (port từ GarageCashflowExportService).
 * Dùng lại GarageCashflowExcelBuilder: dòng được dựng qua toLegacyVoucherResponse nên cột giống hệt bản cũ.
 * Xóa cùng đợt với route cũ (P6).
 */
@Injectable()
export class LegacyVoucherExportService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly excelBuilder: GarageCashflowExcelBuilder,
  ) {}

  async buildExcel(
    dto: GarageCashflowExportDto,
    onProgress: ExportProgressReporter,
  ): Promise<Buffer> {
    onProgress(10, 100, 'Đang chuẩn bị điều kiện xuất dữ liệu...');
    onProgress(25, 100, 'Đang truy vấn dữ liệu từ cơ sở dữ liệu...');
    const rows = await this.loadRows(dto);
    onProgress(
      50,
      100,
      `Đã tìm thấy ${rows.length} phiếu thu chi. Đang tạo file Excel...`,
    );

    const buffer = await this.excelBuilder.build({
      vouchers: rows,
      selectedColumns: dto.selectedColumns,
      onProgress: (percent, msg) => {
        onProgress(Math.round(50 + (percent / 100) * 48), 100, msg);
      },
    });
    onProgress(100, 100, 'Xuất file Excel thành công.');
    return buffer;
  }

  /** Lấy các dòng đã lọc theo điều kiện export, không phân trang. */
  async loadRows(
    dto: GarageCashflowExportDto,
  ): Promise<KgaraCashflowVoucherResponseDto[]> {
    const qb = this.dataSource
      .getRepository(CashflowForecast)
      .createQueryBuilder('f')
      .innerJoin(CashflowGarageForecastExt, 'ext', 'ext.forecastId = f.id')
      .leftJoin(KgaraCase, 'kc', 'kc.id = ext.caseId')
      .where('f.isDeleted = :deleted', { deleted: false })
      .andWhere("(f.sourceType IS NULL OR f.sourceType <> 'LEGACY_PR')");

    this.applyFilters(qb, dto);
    applyExportSorts(qb, dto.sorts);

    const headers = await qb.getMany();
    const exts = await this.loadExts(headers.map((h) => h.id));
    const cases = await this.loadCases(
      [...exts.values()]
        .map((e) => e.caseId)
        .filter((id): id is string => Boolean(id)),
    );
    return headers.map((header) => {
      const ext = exts.get(header.id) ?? null;
      const caseRow = ext?.caseId ? (cases.get(ext.caseId) ?? null) : null;
      return toLegacyVoucherResponse({
        header,
        ext,
        transDate: header.plannedDate ?? '',
        caseRow: caseRow
          ? {
              id: caseRow.id,
              khachHangName: caseRow.khachHangName,
              khachHangCode: caseRow.khachHangCode,
              soChungTu: caseRow.soChungTu,
              bienSoXe: caseRow.bienSoXe,
            }
          : null,
      });
    });
  }

  private applyFilters(qb: Qb, dto: GarageCashflowExportDto): void {
    const isByPeriod =
      dto.mode === 'by-period' ||
      (!dto.mode &&
        Boolean(
          dto.periodType ||
          dto.period ||
          dto.quarter ||
          dto.dateFrom ||
          dto.startDate,
        ));

    if (isByPeriod) {
      const { from, to } = resolvePeriodRange(dto);
      if (from) qb.andWhere('f.plannedDate >= :expFrom', { expFrom: from });
      if (to) qb.andWhere('f.plannedDate <= :expTo', { expTo: to });

      const direction =
        dto.voucherType && dto.voucherType !== 'ALL'
          ? toDirection(dto.voucherType)
          : null;
      if (direction)
        qb.andWhere('f.direction = :expDir', { expDir: direction });

      if (dto.paymentMethod) {
        qb.andWhere('ext.legacyPaymentMethod = :expPMethod', {
          expPMethod: dto.paymentMethod,
        });
      }
      if (dto.paymentStatus) {
        const cond = paymentStatusCondition(dto.paymentStatus, 'expPStatus');
        if (cond) qb.andWhere(cond.sql, cond.params);
      }
      if (dto.accountId) {
        // Tài khoản ngân hàng đi qua thực thu/chi gắn với giao dịch ngân hàng (thay cho bankTx của bản cũ).
        qb.andWhere(
          `EXISTS (SELECT 1 FROM cashflow_allocations a
             JOIN cashflow_payments p ON p.id = a.payment_id
             JOIN erp_bank_transactions bt ON bt.id = p.bank_transaction_id
             WHERE a.forecast_id = f.id AND bt.bank_account_id = :expAccount)`,
          { expAccount: dto.accountId },
        );
      }
    }

    const searchVal = dto.q || dto.search;
    if (searchVal) {
      applyMultiKeywordFilter(
        qb,
        "CONCAT_WS(' ', f.code, f.partner_name, ext.license_plate, ext.payment_content, f.note, kc.so_chung_tu, kc.bien_so_xe, kc.khach_hang_name)",
        searchVal,
        'expSearch',
      );
    }

    if (dto.column_filters) {
      applyLegacyColumnFilters(qb, dto.column_filters);
    }
    if (dto.column_search) {
      applyLegacyColumnSearch(qb, dto.column_search);
    }
  }

  private async loadExts(
    ids: string[],
  ): Promise<Map<string, CashflowGarageForecastExt>> {
    const map = new Map<string, CashflowGarageForecastExt>();
    if (ids.length === 0) return map;
    const rows = await this.dataSource
      .getRepository(CashflowGarageForecastExt)
      .findBy({ forecastId: In(ids) });
    for (const row of rows) map.set(row.forecastId, row);
    return map;
  }

  private async loadCases(ids: string[]): Promise<Map<string, KgaraCase>> {
    const map = new Map<string, KgaraCase>();
    if (ids.length === 0) return map;
    const rows = await this.dataSource
      .getRepository(KgaraCase)
      .findBy({ id: In(ids) });
    for (const row of rows) map.set(row.id, row);
    return map;
  }
}
