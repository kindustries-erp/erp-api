import { NotFoundException } from '@nestjs/common';
import { DataSource, EntityTarget, FindOptionsWhere } from 'typeorm';
import { BaseCashflowForecastEntity } from '../entities/base-cashflow-forecast.entity';

export interface CashflowForecastListFilter {
  direction?: 'IN' | 'OUT';
  kind?: string;
  status?: string;
  branchId?: string;
  page?: number;
  limit?: number;
}

export interface CashflowForecastListResult<H> {
  items: H[];
  total: number;
  page: number;
  limit: number;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 200;

/** Truy vấn chỉ đọc của dự thu / dự chi. Luôn loại bản ghi đã xóa mềm. */
export abstract class AbstractCashflowForecastQueryService<
  H extends BaseCashflowForecastEntity = BaseCashflowForecastEntity,
> {
  protected abstract readonly headerEntity: EntityTarget<H>;

  constructor(protected readonly dataSource: DataSource) {}

  async findOne(id: string): Promise<H> {
    const header = await this.dataSource
      .getRepository(this.headerEntity)
      .findOne({
        where: { id, isDeleted: false } as FindOptionsWhere<H>,
      });
    if (!header) {
      throw new NotFoundException(`Không tìm thấy chứng từ ${id}`);
    }
    return header;
  }

  async list(
    filter: CashflowForecastListFilter = {},
  ): Promise<CashflowForecastListResult<H>> {
    const page = Math.max(1, filter.page ?? 1);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, filter.limit ?? DEFAULT_LIMIT),
    );
    const where = this.buildWhere(filter);
    const [items, total] = await this.dataSource
      .getRepository(this.headerEntity)
      .findAndCount({
        where,
        order: { plannedDate: 'ASC', createdAt: 'DESC' } as never,
        skip: (page - 1) * limit,
        take: limit,
      });
    return { items, total, page, limit };
  }

  /** Điều kiện lọc. Mỗi module có thể override để thêm bộ lọc riêng. */
  protected buildWhere(
    filter: CashflowForecastListFilter,
  ): FindOptionsWhere<H> {
    const where: Record<string, unknown> = { isDeleted: false };
    if (filter.direction) where.direction = filter.direction;
    if (filter.kind) where.kind = filter.kind;
    if (filter.status) where.status = filter.status;
    if (filter.branchId) where.branchId = filter.branchId;
    return where as FindOptionsWhere<H>;
  }
}
