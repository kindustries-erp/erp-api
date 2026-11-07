import { Injectable } from '@nestjs/common';
import { DataSource, In, SelectQueryBuilder } from 'typeorm';
import { KgaraCase } from '@/kgara-api-core/entities/kgara_case.entity';
import type {
  CheckKgaraCashflowDuplicateQueryDto,
  KgaraCashflowDuplicateGroupDto,
  KgaraCashflowDuplicateResponseDto,
} from '@/kgara-api-core/dto/garage-cashflow.dto';
import { CashflowForecast } from '@/v2/core/cashflow-core';
import { CashflowGarageForecastExt } from '../entities/cashflow-garage-forecast-ext.entity';
import { toLegacyVoucherType } from './legacy-voucher.mapper';

/** Các hằng số khớp engine cũ: ±7 ngày, tối đa 5 dòng mỗi nhóm. */
const NEARBY_DAYS = 7;
const MAX_ITEMS = 5;
const EMPTY_GROUP: KgaraCashflowDuplicateGroupDto = { items: [], total: 0 };

/** Bỏ mọi ký tự không phải chữ/số và viết hoa, để so khớp biển số. */
export function normalizePlate(plate?: string | null): string {
  return (plate ?? '').replace(/[^0-9a-zA-Z]/g, '').toUpperCase();
}

/** Cộng/trừ số ngày vào ngày ISO (yyyy-mm-dd), theo UTC như engine cũ. */
export function shiftIsoDate(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Tìm phiếu có nguy cơ trùng (port từ GarageCashflowDuplicateEngine cũ).
 * Ba nhóm: cùng số tiền trong ±7 ngày, cùng phiếu dịch vụ, cùng biển số.
 * Xóa cùng đợt với route cũ (P6).
 */
@Injectable()
export class LegacyVoucherDuplicateService {
  constructor(private readonly dataSource: DataSource) {}

  async findPotentialDuplicates(
    q: CheckKgaraCashflowDuplicateQueryDto,
  ): Promise<KgaraCashflowDuplicateResponseDto> {
    const base = (): SelectQueryBuilder<CashflowForecast> => {
      const qb = this.dataSource
        .getRepository(CashflowForecast)
        .createQueryBuilder('f')
        .innerJoin(CashflowGarageForecastExt, 'ext', 'ext.forecastId = f.id')
        .leftJoin(KgaraCase, 'kc', 'kc.id = ext.caseId')
        .where('f.isDeleted = :deleted', { deleted: false })
        .andWhere("(f.sourceType IS NULL OR f.sourceType <> 'LEGACY_PR')")
        .andWhere('f.amount = :amount', { amount: q.amount });
      if (q.excludeId) {
        qb.andWhere('f.id <> :excludeId', { excludeId: q.excludeId });
      }
      return qb;
    };

    const run = async (
      qb: SelectQueryBuilder<CashflowForecast>,
    ): Promise<KgaraCashflowDuplicateGroupDto> => {
      const total = await qb.clone().orderBy().getCount();
      const headers = await qb
        .orderBy('f.plannedDate', 'DESC')
        .addOrderBy('f.createdAt', 'DESC')
        .offset(0)
        .limit(MAX_ITEMS)
        .getMany();
      const exts = await this.loadExts(headers.map((h) => h.id));
      const cases = await this.loadCases(
        [...exts.values()]
          .map((e) => e.caseId)
          .filter((id): id is string => Boolean(id)),
      );
      return {
        total,
        items: headers.map((h) => {
          const ext = exts.get(h.id) ?? null;
          const caseRow = ext?.caseId ? (cases.get(ext.caseId) ?? null) : null;
          return {
            id: h.id,
            voucherCode: h.code,
            voucherType: toLegacyVoucherType(h.direction),
            amount: Number(h.amount) || 0,
            transDate: h.plannedDate ?? '',
            licensePlate: ext?.licensePlate ?? null,
            caseCode: caseRow?.soChungTu ?? null,
            partnerName: h.partnerName ?? null,
          };
        }),
      };
    };

    const center = q.transDate || new Date().toISOString().slice(0, 10);
    const nearbyQb = base().andWhere('f.plannedDate BETWEEN :from AND :to', {
      from: shiftIsoDate(center, -NEARBY_DAYS),
      to: shiftIsoDate(center, NEARBY_DAYS),
    });

    const plate = normalizePlate(q.licensePlate);
    const [nearbyDate, sameCase, samePlate] = await Promise.all([
      run(nearbyQb),
      q.caseId
        ? run(base().andWhere('ext.caseId = :caseId', { caseId: q.caseId }))
        : EMPTY_GROUP,
      plate
        ? run(
            base().andWhere(
              "regexp_replace(upper(COALESCE(ext.license_plate, kc.bien_so_xe, '')), '[^0-9A-Z]', '', 'g') = :plate",
              { plate },
            ),
          )
        : EMPTY_GROUP,
    ]);
    return { nearbyDate, sameCase, samePlate };
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
