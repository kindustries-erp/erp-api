import { Injectable } from '@nestjs/common';
import { DataSource, In, SelectQueryBuilder } from 'typeorm';
import type { PeriodLedger } from '@/kgara-api-core/hub/garage-hub.types';
import type { PeriodVoucherRow } from '@/kgara-api-core/helpers/garage-period-voucher-rows.helper';
import {
  classifyVoucher,
  summarizeLedger,
  type LedgerVoucherRow,
} from '@/kgara-api-core/helpers/garage-ledger-classifier';
import { KgaraCase } from '@/kgara-api-core/entities/kgara_case.entity';
import { CashflowForecast } from '@/v2/core/cashflow-core';
import { CashflowGarageForecastExt } from '../entities/cashflow-garage-forecast-ext.entity';
import { toLegacyVoucherResponse } from './legacy-voucher.mapper';

/** Gộp theo phiếu dịch vụ: dự thu và dự chi chưa thực tế (cho bảng kê phiếu dịch vụ). */
export interface LegacyCaseLedgerAmounts {
  expectedIn: number;
  plannedOut: number;
}

const CASE_ID_CHUNK = 2000;

const toDay = (value?: string) => (value ? value.slice(0, 10) : undefined);

type Qb = SelectQueryBuilder<CashflowForecast>;

/**
 * Dữ liệu kỳ và sổ quỹ cho báo cáo và hub, theo hình dạng cũ.
 * Phân loại dùng lại classifyVoucher/summarizeLedger của bản cũ, đưa vào nhãn trạng thái cũ
 * (cùng nguồn sự thật với toLegacyPaymentStatus), nên kết quả không đổi.
 * Chưa gồm P&L theo tháng (thuộc task 2.5). Xóa cùng đợt với route cũ (P6).
 */
@Injectable()
export class LegacyVoucherPeriodService {
  constructor(private readonly dataSource: DataSource) {}

  private baseQb(): Qb {
    return this.dataSource
      .getRepository(CashflowForecast)
      .createQueryBuilder('f')
      .innerJoin(CashflowGarageForecastExt, 'ext', 'ext.forecastId = f.id')
      .leftJoin(KgaraCase, 'kc', 'kc.id = ext.caseId')
      .where('f.isDeleted = :deleted', { deleted: false })
      .andWhere("(f.sourceType IS NULL OR f.sourceType <> 'LEGACY_PR')");
  }

  /**
   * Phiếu thu/chi trong kỳ theo ngày dự kiến. Chi nhánh đi qua phiếu dịch vụ;
   * phiếu không gắn phiếu dịch vụ luôn được giữ (như bản cũ).
   */
  async loadVouchers(
    from?: string,
    to?: string,
    branchId?: string,
  ): Promise<PeriodVoucherRow[]> {
    const qb = this.baseQb();
    const dayFrom = toDay(from);
    const dayTo = toDay(to);
    if (dayFrom) qb.andWhere('f.plannedDate >= :dayFrom', { dayFrom });
    if (dayTo) qb.andWhere('f.plannedDate <= :dayTo', { dayTo });
    if (branchId) {
      qb.andWhere(
        '(ext.caseId IS NULL OR kc.branchExternalId = :branchId OR kc.branchExternalId IS NULL)',
        { branchId },
      );
    }
    const headers = await qb
      .orderBy('f.plannedDate', 'ASC')
      .addOrderBy('f.createdAt', 'ASC')
      .getMany();

    const exts = await this.loadExts(headers.map((h) => h.id));
    const cases = await this.loadCases(
      [...exts.values()]
        .map((e) => e.caseId)
        .filter((id): id is string => Boolean(id)),
    );

    return headers.map((header) => {
      const ext = exts.get(header.id) ?? null;
      const caseRow = ext?.caseId ? (cases.get(ext.caseId) ?? null) : null;
      const v = toLegacyVoucherResponse({
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
      return {
        voucherCode: v.voucherCode,
        transDate: String(v.transDate ?? '').slice(0, 10),
        type: v.voucherType === 'PAYMENT' ? 'PAYMENT' : 'RECEIPT',
        paymentStatus: v.paymentStatus ?? null,
        paymentContent: v.paymentContent ?? '',
        partnerName: v.partnerName ?? '',
        licensePlate: v.licensePlate || caseRow?.bienSoXe || '',
        soChungTu: caseRow?.soChungTu ?? '',
        paymentMethod: v.paymentMethod ?? '',
        note: v.note ?? '',
        amount: Number(v.amount) || 0,
      };
    });
  }

  /** Sổ quỹ kỳ: phân nhóm dòng tiền, bỏ phiếu đã hủy, cộng tổng. */
  async loadLedger(
    from?: string,
    to?: string,
    branchId?: string,
  ): Promise<PeriodLedger> {
    const rows = await this.loadVouchers(from, to, branchId);
    const vouchers: LedgerVoucherRow[] = [];
    for (const row of rows) {
      const category = classifyVoucher({
        voucherType: row.type,
        paymentStatus: row.paymentStatus,
      });
      if (category) vouchers.push({ ...row, category });
    }
    return { vouchers, totals: summarizeLedger(vouchers) };
  }

  /** Dự thu/dự chi chưa thực tế theo từng phiếu dịch vụ (đã hủy không tính). */
  async loadCaseLedger(
    caseIds: string[],
  ): Promise<Record<string, LegacyCaseLedgerAmounts>> {
    const result: Record<string, LegacyCaseLedgerAmounts> = {};
    const ids = [...new Set(caseIds.filter(Boolean))];
    for (let i = 0; i < ids.length; i += CASE_ID_CHUNK) {
      const chunk = ids.slice(i, i + CASE_ID_CHUNK);
      const headers = await this.baseQb()
        .andWhere('ext.caseId IN (:...chunk)', { chunk })
        .getMany();
      const exts = await this.loadExts(headers.map((h) => h.id));

      for (const header of headers) {
        const caseId = exts.get(header.id)?.caseId;
        if (!caseId) continue;
        const v = toLegacyVoucherResponse({
          header,
          ext: exts.get(header.id) ?? null,
          transDate: header.plannedDate ?? '',
        });
        const category = classifyVoucher({
          voucherType: v.voucherType,
          paymentStatus: v.paymentStatus,
        });
        if (category !== 'EXPECTED_IN' && category !== 'PLANNED_OUT') continue;
        const entry = result[caseId] ?? { expectedIn: 0, plannedOut: 0 };
        const amount = Number(header.amount) || 0;
        if (category === 'EXPECTED_IN') entry.expectedIn += amount;
        else entry.plannedOut += amount;
        result[caseId] = entry;
      }
    }
    return result;
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
