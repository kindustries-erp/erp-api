import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { applyMultiKeywordFilter } from '@/common/utils/query-builder.util';
import { KgaraCase } from '@/kgara-api-core/entities/kgara_case.entity';
import { CashflowForecast } from '@/v2/core/cashflow-core';
import { CashflowGarageForecastExt } from '../entities/cashflow-garage-forecast-ext.entity';
import {
  applyLegacyColumnFilters,
  parseLegacyJson,
} from './legacy-voucher-list.filters';
import { tabStatusCondition } from './legacy-voucher-list.service';
import { PAYMENT_STATUS_SQL } from './legacy-voucher-sql';
/** Biểu thức SQL của từng cột tùy chọn, alias: f, ext, kc. */
const COLUMN_SQL: Record<string, string> = {
  voucherCode: 'f.code',
  partnerName: 'COALESCE(f.partner_name, kc.khach_hang_name)',
  licensePlate: 'COALESCE(ext.license_plate, kc.bien_so_xe)',
  paymentMethod: 'ext.legacy_payment_method',
  paymentContent: 'ext.payment_content',
  note: 'f.note',
  caseCode: 'kc.so_chung_tu',
  transDate: 'f.planned_date',
  thu: 'f.amount',
  chi: 'f.amount',
  paymentStatus: PAYMENT_STATUS_SQL,
};

export interface LegacyColumnOptionsResult {
  items: string[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Gợi ý giá trị cho lọc cột của danh sách tương thích (port từ getColumnOptions cũ).
 * Giữ hành vi: bỏ điều kiện lọc của chính cột đang lấy gợi ý, bỏ giá trị rỗng và NULL,
 * sắp xếp tăng dần, phân trang trên danh sách giá trị khác nhau.
 * Xóa cùng đợt với route cũ (P6).
 */
@Injectable()
export class LegacyVoucherOptionsService {
  constructor(private readonly dataSource: DataSource) {}

  async getColumnOptions(
    column: string,
    search: string,
    page = 1,
    pageSize = 20,
    filtersStr?: string,
    tab?: string,
  ): Promise<LegacyColumnOptionsResult> {
    const expr = COLUMN_SQL[column];
    if (!expr) return { items: [], total: 0, page, pageSize, totalPages: 0 };

    const qb = this.dataSource
      .getRepository(CashflowForecast)
      .createQueryBuilder('f')
      .innerJoin(CashflowGarageForecastExt, 'ext', 'ext.forecastId = f.id')
      .leftJoin(KgaraCase, 'kc', 'kc.id = ext.caseId')
      .where('f.isDeleted = :deleted', { deleted: false })
      .andWhere("(f.sourceType IS NULL OR f.sourceType <> 'LEGACY_PR')");

    if (column === 'thu') qb.andWhere("f.direction = 'IN'");
    if (column === 'chi') qb.andWhere("f.direction = 'OUT'");
    if (column === 'paymentStatus' && tab === 'vouchers') {
      qb.andWhere("f.direction = 'OUT'");
    }

    const statusCondition = tabStatusCondition(
      tab as 'vouchers' | 'forecast' | 'all' | undefined,
      undefined,
    );
    if (statusCondition) qb.andWhere(statusCondition);

    qb.select(`DISTINCT ${expr}`, 'value').andWhere(`${expr} IS NOT NULL`);
    qb.andWhere(`CAST(${expr} AS TEXT) != ''`);

    // Bỏ điều kiện của chính cột đang lấy gợi ý (như engine cũ).
    const others = parseLegacyJson(filtersStr);
    delete others[column];
    applyLegacyColumnFilters(qb, JSON.stringify(others));

    if (search) {
      applyMultiKeywordFilter(qb, `CAST(${expr} AS TEXT)`, search, 'search');
    }

    const countQb = qb.clone().orderBy();
    const totalRaw = await countQb
      .select(`COUNT(DISTINCT ${expr})`, 'cnt')
      .getRawOne<{ cnt: string }>();
    const total = parseInt(totalRaw?.cnt || '0', 10);

    const rows = await qb
      .orderBy('value', 'ASC')
      .offset((page - 1) * pageSize)
      .limit(pageSize)
      .getRawMany<{ value: unknown }>();

    return {
      items: rows.map((r) => String(r.value)).filter(Boolean),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
