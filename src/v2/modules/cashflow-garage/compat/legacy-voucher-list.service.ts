import { Injectable } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { ErpBankTransaction } from '@/bank-transactions-core/entities/erp_bank_transaction.entity';
import { KgaraCase } from '@/kgara-api-core/entities/kgara_case.entity';
import type {
  KgaraCashflowVoucherResponseDto,
  ListKgaraCashflowVouchersResponseDto,
} from '@/kgara-api-core/dto/garage-cashflow.dto';
import { CashflowForecast } from '@/v2/core/cashflow-core';
import { CashflowGarageForecastExt } from '../entities/cashflow-garage-forecast-ext.entity';
import { toLegacyVoucherResponse } from './legacy-voucher.mapper';
import {
  applyLegacyColumnFilters,
  applyLegacyColumnSearch,
  applyLegacySorts,
} from './legacy-voucher-list.filters';

export interface LegacyVoucherListQuery {
  date_from?: string;
  date_to?: string;
  voucher_type?: 'RECEIPT' | 'PAYMENT';
  case_id?: string;
  page?: number;
  pageSize?: number;
  tab?: 'vouchers' | 'forecast' | 'all';
  ledger_type?: 'ACTUAL' | 'FORECAST' | 'ALL';
  column_filters?: string;
  column_search?: string;
  sorts?: string | string[];
  'sorts[]'?: string | string[];
}

/**
 * Điều kiện trạng thái theo tab cũ. Tab "dự kiến" (forecast) là mọi dòng chưa thu/chi xong,
 * tab "thực tế" (vouchers/actual) là dòng đã settled. Ưu tiên forecast khi cả hai cùng được gửi, như engine cũ.
 * Trả null nếu không lọc theo tab.
 */
export function tabStatusCondition(
  tab: LegacyVoucherListQuery['tab'],
  ledgerType: LegacyVoucherListQuery['ledger_type'],
): string | null {
  const isForecast = tab === 'forecast' || ledgerType === 'FORECAST';
  const isActual = tab === 'vouchers' || ledgerType === 'ACTUAL';
  if (isForecast) return "f.status NOT IN ('SETTLED', 'CANCELLED')";
  if (isActual) return "f.status = 'SETTLED'";
  return null;
}

function sumByDirection(headers: CashflowForecast[]): {
  thu: number;
  chi: number;
} {
  return headers.reduce(
    (acc, h) => {
      const amount = Number(h.amount) || 0;
      if (h.direction === 'IN') acc.thu += amount;
      else acc.chi += amount;
      return acc;
    },
    { thu: 0, chi: 0 },
  );
}

/**
 * Danh sách phiếu thu chi theo hình dạng cũ, đọc từ dự thu/dự chi mới.
 * Hỗ trợ: ngày, loại, chứng từ, tab/ledger, lọc cột, tìm kiếm, sắp xếp, phân trang, tổng và tổng lũy kế.
 * Chưa hỗ trợ (sẽ port sau): join giao dịch ngân hàng, cột tùy chọn, dashboard, export.
 */
@Injectable()
export class LegacyVoucherListService {
  constructor(private readonly dataSource: DataSource) {}

  async list(
    query: LegacyVoucherListQuery,
  ): Promise<ListKgaraCashflowVouchersResponseDto> {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;

    const qb = this.dataSource
      .getRepository(CashflowForecast)
      .createQueryBuilder('f')
      .innerJoin(CashflowGarageForecastExt, 'ext', 'ext.forecastId = f.id')
      .leftJoin(KgaraCase, 'kc', 'kc.id = ext.caseId')
      .where('f.isDeleted = :deleted', { deleted: false })
      // Đề nghị mua hàng cũ không phải phiếu thu chi: loại khỏi danh sách tương thích.
      .andWhere("(f.sourceType IS NULL OR f.sourceType <> 'LEGACY_PR')");

    if (query.date_from) {
      qb.andWhere('f.plannedDate >= :dateFrom', { dateFrom: query.date_from });
    }
    if (query.date_to) {
      qb.andWhere('f.plannedDate <= :dateTo', { dateTo: query.date_to });
    }
    if (query.voucher_type) {
      qb.andWhere('f.direction = :direction', {
        direction: query.voucher_type === 'RECEIPT' ? 'IN' : 'OUT',
      });
    }
    if (query.case_id) {
      qb.andWhere('ext.caseId = :caseId', { caseId: query.case_id });
    }
    const statusCondition = tabStatusCondition(query.tab, query.ledger_type);
    if (statusCondition) qb.andWhere(statusCondition);

    applyLegacyColumnFilters(qb, query.column_filters);
    applyLegacyColumnSearch(qb, query.column_search);

    // Tổng toàn bộ kết quả lọc (không phân trang, không sắp xếp).
    const totalsRaw = await qb
      .clone()
      .orderBy()
      .select(
        "COALESCE(SUM(CASE WHEN f.direction = 'IN' THEN f.amount ELSE 0 END), 0)",
        'totalThu',
      )
      .addSelect(
        "COALESCE(SUM(CASE WHEN f.direction = 'OUT' THEN f.amount ELSE 0 END), 0)",
        'totalChi',
      )
      .getRawOne<{ totalThu: string; totalChi: string }>();
    const grandTotalThu = parseFloat(totalsRaw?.totalThu || '0') || 0;
    const grandTotalChi = parseFloat(totalsRaw?.totalChi || '0') || 0;

    const total = await qb.clone().orderBy().getCount();
    const totalPages = Math.ceil(total / pageSize) || 1;

    applyLegacySorts(
      qb,
      [query.sorts, query['sorts[]']]
        .flat()
        .filter((s): s is string => typeof s === 'string'),
    );

    // offset/limit thay vì skip/take: quan hệ là 1-1 nên không có nhân dòng,
    // và tránh subquery DISTINCT của TypeORM khi sắp xếp theo cột join.
    const headers = await qb
      .clone()
      .offset((page - 1) * pageSize)
      .limit(pageSize)
      .getMany();

    let cumulativeThu = 0;
    let cumulativeChi = 0;
    if (page === 1) {
      const sums = sumByDirection(headers);
      cumulativeThu = sums.thu;
      cumulativeChi = sums.chi;
    } else if (page >= totalPages) {
      cumulativeThu = grandTotalThu;
      cumulativeChi = grandTotalChi;
    } else {
      const upTo = await qb
        .clone()
        .offset(0)
        .limit(page * pageSize)
        .getMany();
      const sums = sumByDirection(upTo);
      cumulativeThu = sums.thu;
      cumulativeChi = sums.chi;
    }

    const exts = await this.loadExts(headers.map((h) => h.id));
    const cases = await this.loadCases(
      [...exts.values()]
        .map((e) => e.caseId)
        .filter((id): id is string => Boolean(id)),
    );

    const bankLinks = await this.loadBankLinks(headers.map((h) => h.id));
    const bankRows = await this.loadBankRows([...bankLinks.values()]);

    const data: KgaraCashflowVoucherResponseDto[] = headers.map((header) => {
      const ext = exts.get(header.id) ?? null;
      const caseRow = ext?.caseId ? (cases.get(ext.caseId) ?? null) : null;
      const bankId = bankLinks.get(header.id) ?? null;
      const bankRow = bankId ? (bankRows.get(bankId) ?? null) : null;
      return toLegacyVoucherResponse({
        header,
        ext,
        transDate: header.plannedDate ?? '',
        erpBankTransactionId: bankId,
        bankRow: bankRow
          ? {
              id: bankRow.id,
              referenceNumber: bankRow.referenceNumber,
              seqNo: bankRow.seqNo,
            }
          : null,
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

    return {
      data,
      total,
      totalPages,
      totals: {
        grandTotalThu,
        grandTotalChi,
        cumulativeThu,
        cumulativeChi,
      },
    };
  }

  private async loadExts(
    forecastIds: string[],
  ): Promise<Map<string, CashflowGarageForecastExt>> {
    const map = new Map<string, CashflowGarageForecastExt>();
    if (forecastIds.length === 0) return map;
    const rows = await this.dataSource
      .getRepository(CashflowGarageForecastExt)
      .findBy({ forecastId: In(forecastIds) });
    for (const row of rows) map.set(row.forecastId, row);
    return map;
  }

  /**
   * Link giao dịch ngân hàng của từng dự thu/dự chi, lấy qua phân bổ tới thực thu/chi.
   * Đọc bảng `cashflow_payments` bằng SQL vì chưa có entity cho bảng này.
   */
  private async loadBankLinks(
    forecastIds: string[],
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (forecastIds.length === 0) return map;
    const rows = await this.dataSource.query<
      Array<{ forecastId: string; bankTransactionId: string }>
    >(
      `SELECT a.forecast_id AS "forecastId", p.bank_transaction_id AS "bankTransactionId"
       FROM cashflow_allocations a
       JOIN cashflow_payments p ON p.id = a.payment_id
       WHERE a.forecast_id = ANY($1::uuid[])
         AND p.bank_transaction_id IS NOT NULL`,
      [forecastIds],
    );
    for (const row of rows) map.set(row.forecastId, row.bankTransactionId);
    return map;
  }

  private async loadBankRows(
    bankIds: string[],
  ): Promise<Map<string, ErpBankTransaction>> {
    const map = new Map<string, ErpBankTransaction>();
    if (bankIds.length === 0) return map;
    const rows = await this.dataSource
      .getRepository(ErpBankTransaction)
      .findBy({ id: In(bankIds) });
    for (const row of rows) map.set(row.id, row);
    return map;
  }

  private async loadCases(caseIds: string[]): Promise<Map<string, KgaraCase>> {
    const map = new Map<string, KgaraCase>();
    if (caseIds.length === 0) return map;
    const rows = await this.dataSource
      .getRepository(KgaraCase)
      .findBy({ id: In(caseIds) });
    for (const row of rows) map.set(row.id, row);
    return map;
  }
}
