import { Injectable } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import {
  AbstractCashflowForecastQueryService,
  CashflowForecast,
  CashflowForecastLine,
  CashflowForecastListFilter,
  CashflowForecastListResult,
} from '@/v2/core/cashflow-core';
import { CashflowGarageForecastExt } from '../entities/cashflow-garage-forecast-ext.entity';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 200;

@Injectable()
export class GarageForecastQueryService extends AbstractCashflowForecastQueryService<CashflowForecast> {
  protected readonly headerEntity = CashflowForecast;

  constructor(dataSource: DataSource) {
    super(dataSource);
  }

  /** Chỉ lấy dự thu/dự chi có dòng ext Garage. Các họ khác dùng chung bảng header sẽ không lọt vào. */
  async listGarage(
    filter: CashflowForecastListFilter = {},
  ): Promise<CashflowForecastListResult<CashflowForecast>> {
    const page = Math.max(1, filter.page ?? 1);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, filter.limit ?? DEFAULT_LIMIT),
    );
    const qb = this.dataSource
      .getRepository(CashflowForecast)
      .createQueryBuilder('f')
      .innerJoin(CashflowGarageForecastExt, 'ext', 'ext.forecastId = f.id')
      .where('f.isDeleted = :deleted', { deleted: false });
    if (filter.direction) {
      qb.andWhere('f.direction = :direction', { direction: filter.direction });
    }
    if (filter.kind) {
      qb.andWhere('f.kind = :kind', { kind: filter.kind });
    }
    if (filter.status) {
      qb.andWhere('f.status = :status', { status: filter.status });
    }
    if (filter.branchId) {
      qb.andWhere('f.branchId = :branchId', { branchId: filter.branchId });
    }
    const [items, total] = await qb
      .orderBy('f.plannedDate', 'ASC')
      .addOrderBy('f.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { items, total, page, limit };
  }

  async findExt(forecastId: string): Promise<CashflowGarageForecastExt | null> {
    return this.dataSource
      .getRepository(CashflowGarageForecastExt)
      .findOne({ where: { forecastId } });
  }

  /** Lấy ext của nhiều dự thu/dự chi một lần, tránh truy vấn lặp theo từng dòng. */
  async findExtsByIds(
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

  async findLines(forecastId: string): Promise<CashflowForecastLine[]> {
    return this.dataSource.getRepository(CashflowForecastLine).find({
      where: { forecastId },
      order: { lineNo: 'ASC' },
    });
  }
}
