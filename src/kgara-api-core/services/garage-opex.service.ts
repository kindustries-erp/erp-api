import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KgaraOperatingExpense } from '../entities/kgara_operating_expense.entity';
import {
  CreateGarageOpexDto,
  UpdateGarageOpexDto,
  ListGarageOpexQueryDto,
} from '../dto/garage-opex.dto';

@Injectable()
export class GarageOpexService {
  constructor(
    @InjectRepository(KgaraOperatingExpense)
    private readonly opexRepo: Repository<KgaraOperatingExpense>,
  ) {}

  /**
   * Lấy danh sách chi phí vận hành có phân trang, sort và server-side filtering
   */
  async getList(query: ListGarageOpexQueryDto) {
    const page = Math.max(Number(query.page) || 1, 1);
    const pageSize = Math.max(Number(query.pageSize) || 20, 1);

    const qb = this.opexRepo.createQueryBuilder('opex');

    // Filter year / month
    if (query.year) {
      qb.andWhere('opex.period_year = :year', { year: Number(query.year) });
    }
    if (query.month) {
      qb.andWhere('opex.period_month = :month', { month: Number(query.month) });
    }

    // Column Filters
    if (query.column_filters) {
      try {
        const filters = JSON.parse(query.column_filters) as Record<
          string,
          string[]
        >;
        for (const [col, values] of Object.entries(filters)) {
          if (!values || values.length === 0) continue;

          if (values[0] === '__ALL_MATCHING__') {
            const searchVal = (values[1] || '').trim();
            if (!searchVal) continue;
            if (col === 'categoryKey') {
              qb.andWhere('opex.category_key ILIKE :catKeySearch', {
                catKeySearch: `%${searchVal}%`,
              });
            } else if (col === 'categoryName') {
              qb.andWhere('opex.category_name ILIKE :catNameSearch', {
                catNameSearch: `%${searchVal}%`,
              });
            } else if (col === 'note') {
              qb.andWhere('opex.note ILIKE :noteSearch', {
                noteSearch: `%${searchVal}%`,
              });
            }
            continue;
          }

          if (col === 'categoryKey') {
            qb.andWhere('opex.category_key IN (:...catKeys)', {
              catKeys: values,
            });
          } else if (col === 'categoryName') {
            qb.andWhere('opex.category_name IN (:...catNames)', {
              catNames: values,
            });
          } else if (col === 'period') {
            // format MM/YYYY
            const periodConditions = values.map((p, idx) => {
              const [m, y] = p.split('/').map(Number);
              return `(opex.period_month = :pMonth_${idx} AND opex.period_year = :pYear_${idx})`;
            });
            const periodParams = values.reduce(
              (acc, p, idx) => {
                const [m, y] = p.split('/').map(Number);
                acc[`pMonth_${idx}`] = m;
                acc[`pYear_${idx}`] = y;
                return acc;
              },
              {} as Record<string, number>,
            );
            if (periodConditions.length > 0) {
              qb.andWhere(`(${periodConditions.join(' OR ')})`, periodParams);
            }
          }
        }
      } catch (err) {
        // ignore parse error
      }
    }

    // Column Search
    if (query.column_search) {
      try {
        const searches = JSON.parse(query.column_search) as Record<
          string,
          string
        >;
        for (const [col, val] of Object.entries(searches)) {
          if (!val || !val.trim()) continue;
          const searchVal = `%${val.trim()}%`;
          if (col === 'categoryKey') {
            qb.andWhere('opex.category_key ILIKE :cSearchKey', {
              cSearchKey: searchVal,
            });
          } else if (col === 'categoryName') {
            qb.andWhere('opex.category_name ILIKE :cSearchName', {
              cSearchName: searchVal,
            });
          } else if (col === 'note') {
            qb.andWhere('opex.note ILIKE :cSearchNote', {
              cSearchNote: searchVal,
            });
          }
        }
      } catch (err) {
        // ignore parse error
      }
    }

    // Sorting
    const sortList = Array.isArray(query.sorts)
      ? query.sorts
      : query.sorts
        ? [query.sorts]
        : [];
    if (sortList.length > 0) {
      for (const s of sortList) {
        const isDesc = s.startsWith('-');
        const field = isDesc ? s.substring(1) : s;
        const direction = isDesc ? 'DESC' : 'ASC';

        if (field === 'period' || field === 'periodYear') {
          qb.addOrderBy('opex.period_year', direction);
          qb.addOrderBy('opex.period_month', direction);
        } else if (field === 'categoryKey') {
          qb.addOrderBy('opex.category_key', direction);
        } else if (field === 'categoryName') {
          qb.addOrderBy('opex.category_name', direction);
        } else if (field === 'amount') {
          qb.addOrderBy('opex.amount', direction);
        } else if (field === 'createdAt') {
          qb.addOrderBy('opex.created_at', direction);
        }
      }
    } else {
      // Default sorting: periodYear DESC, periodMonth DESC, createdAt DESC
      qb.orderBy('opex.period_year', 'DESC')
        .addOrderBy('opex.period_month', 'DESC')
        .addOrderBy('opex.created_at', 'DESC');
    }

    const [rawItems, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    const data = rawItems.map((item) => ({
      ...item,
      amount: Number(item.amount) || 0,
      period: `${String(item.periodMonth).padStart(2, '0')}/${item.periodYear}`,
    }));

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Lấy distinct values cho bộ lọc header cột
   */
  async getColumnOptions(
    columnKey: string,
    search?: string,
    page: number = 1,
    pageSize: number = 20,
    filtersStr?: string,
  ) {
    const safePage = Math.max(Number(page) || 1, 1);
    const safePageSize = Math.max(Number(pageSize) || 20, 1);

    const qb = this.opexRepo.createQueryBuilder('opex');

    if (filtersStr) {
      try {
        const filters = JSON.parse(filtersStr) as Record<string, string[]>;
        for (const [col, values] of Object.entries(filters)) {
          if (col === columnKey || !values || values.length === 0) continue;
          if (col === 'categoryKey') {
            qb.andWhere('opex.category_key IN (:...filterCatKeys)', {
              filterCatKeys: values,
            });
          }
        }
      } catch (e) {
        // ignore
      }
    }

    let distinctField = 'opex.category_name';
    let fieldAlias = 'value';

    if (columnKey === 'categoryKey') {
      distinctField = 'opex.category_key';
    } else if (columnKey === 'categoryName') {
      distinctField = 'opex.category_name';
    } else if (columnKey === 'period') {
      distinctField = `LPAD(opex.period_month::text, 2, '0') || '/' || opex.period_year::text`;
    }

    qb.select(`DISTINCT (${distinctField})`, fieldAlias);

    if (search && search.trim()) {
      qb.andWhere(`${distinctField} ILIKE :search`, {
        search: `%${search.trim()}%`,
      });
    }

    qb.orderBy(fieldAlias, 'ASC');

    const allOptions = await qb.getRawMany();
    const values = allOptions
      .map((r) => r[fieldAlias])
      .filter((v) => v !== null && v !== undefined && v !== '');

    const total = values.length;
    const paginated = values.slice(
      (safePage - 1) * safePageSize,
      safePage * safePageSize,
    );

    return {
      data: paginated,
      total,
      page: safePage,
      pageSize: safePageSize,
      totalPages: Math.ceil(total / safePageSize),
    };
  }

  async getById(id: string) {
    const item = await this.opexRepo.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException(`Chi phí vận hành ${id} không tồn tại`);
    }
    return {
      ...item,
      amount: Number(item.amount) || 0,
      period: `${String(item.periodMonth).padStart(2, '0')}/${item.periodYear}`,
    };
  }

  async create(dto: CreateGarageOpexDto, userId?: string) {
    const item = this.opexRepo.create({
      periodYear: Number(dto.periodYear),
      periodMonth: Number(dto.periodMonth),
      categoryKey: dto.categoryKey,
      categoryName: dto.categoryName,
      amount: Number(dto.amount) || 0,
      note: dto.note || null,
      createdBy: userId || null,
    });
    const saved = await this.opexRepo.save(item);
    return {
      ...saved,
      amount: Number(saved.amount) || 0,
      period: `${String(saved.periodMonth).padStart(2, '0')}/${saved.periodYear}`,
    };
  }

  async update(id: string, dto: UpdateGarageOpexDto) {
    const item = await this.opexRepo.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException(`Chi phí vận hành ${id} không tồn tại`);
    }

    if (dto.periodYear !== undefined) item.periodYear = Number(dto.periodYear);
    if (dto.periodMonth !== undefined)
      item.periodMonth = Number(dto.periodMonth);
    if (dto.categoryKey !== undefined) item.categoryKey = dto.categoryKey;
    if (dto.categoryName !== undefined) item.categoryName = dto.categoryName;
    if (dto.amount !== undefined) item.amount = Number(dto.amount) || 0;
    if (dto.note !== undefined) item.note = dto.note || null;

    const updated = await this.opexRepo.save(item);
    return {
      ...updated,
      amount: Number(updated.amount) || 0,
      period: `${String(updated.periodMonth).padStart(2, '0')}/${updated.periodYear}`,
    };
  }

  async delete(id: string) {
    const item = await this.opexRepo.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException(`Chi phí vận hành ${id} không tồn tại`);
    }
    await this.opexRepo.remove(item);
    return { success: true, id };
  }

  /**
   * Tổng hợp chi phí vận hành cho kỳ Year/Month (phục vụ P&L report)
   */
  async getSummaryByPeriod(year: number, month: number) {
    const items = await this.opexRepo.find({
      where: {
        periodYear: year,
        periodMonth: month,
      },
      order: {
        createdAt: 'ASC',
      },
    });

    const opexItems: Array<{
      id: string;
      categoryKey: string;
      categoryName: string;
      amount: number;
      note?: string | null;
    }> = [];

    const commissionItems: Array<{
      id: string;
      categoryKey: string;
      categoryName: string;
      amount: number;
      note?: string | null;
    }> = [];

    let totalOpex = 0;
    let totalCommission = 0;

    for (const item of items) {
      const amt = Number(item.amount) || 0;
      const row = {
        id: item.id,
        categoryKey: item.categoryKey,
        categoryName: item.categoryName,
        amount: amt,
        note: item.note,
      };

      if (item.categoryKey.startsWith('HOA_HONG_')) {
        commissionItems.push(row);
        totalCommission += amt;
      } else {
        opexItems.push(row);
        totalOpex += amt;
      }
    }

    return {
      opex: {
        total: totalOpex,
        items: opexItems,
      },
      commission: {
        total: totalCommission,
        items: commissionItems,
      },
    };
  }
}
