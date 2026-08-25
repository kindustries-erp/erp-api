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
      qb.andWhere('opex.period_month = :month', {
        month: Number(query.month),
      });
    }

    // Filter date_from / date_to (Period range)
    if (query.date_from) {
      const fromParts = query.date_from.split('-').map(Number);
      const fromYear = fromParts[0];
      const fromMonth = fromParts[1] || 1;
      const fromPeriodInt = fromYear * 100 + fromMonth;
      qb.andWhere(
        '(opex.period_year * 100 + opex.period_month) >= :fromPeriodInt',
        {
          fromPeriodInt,
        },
      );
    }
    if (query.date_to) {
      const toParts = query.date_to.split('-').map(Number);
      const toYear = toParts[0];
      const toMonth = toParts[1] || 12;
      const toPeriodInt = toYear * 100 + toMonth;
      qb.andWhere(
        '(opex.period_year * 100 + opex.period_month) <= :toPeriodInt',
        {
          toPeriodInt,
        },
      );
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
      ojAmount: Number(item.ojAmount) || 0,
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
      ojAmount: Number(item.ojAmount) || 0,
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
      ojAmount: Number(dto.ojAmount) || 0,
      note: dto.note || null,
      recurrenceType: dto.recurrenceType || null,
      recurrenceUntilYear: dto.recurrenceUntilYear
        ? Number(dto.recurrenceUntilYear)
        : null,
      recurrenceUntilMonth: dto.recurrenceUntilMonth
        ? Number(dto.recurrenceUntilMonth)
        : null,
      recurrenceAnchorId: dto.recurrenceAnchorId || null,
      createdBy: userId || null,
    });
    const saved = await this.opexRepo.save(item);

    // If recurring was configured upon creation with an until period, generate future months
    if (
      saved.recurrenceType === 'monthly' &&
      saved.recurrenceUntilYear &&
      saved.recurrenceUntilMonth
    ) {
      await this.applyRecurring(
        saved.id,
        {
          applyScope: 'this_and_future',
          amount: Number(saved.amount),
          ojAmount: Number(saved.ojAmount) || 0,
          categoryKey: saved.categoryKey,
          categoryName: saved.categoryName,
          note: saved.note || undefined,
          recurrenceType: 'monthly',
          untilYear: saved.recurrenceUntilYear,
          untilMonth: saved.recurrenceUntilMonth,
        },
        userId,
      );
    }

    return {
      ...saved,
      amount: Number(saved.amount) || 0,
      ojAmount: Number(saved.ojAmount) || 0,
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
    if (dto.ojAmount !== undefined) item.ojAmount = Number(dto.ojAmount) || 0;
    if (dto.note !== undefined) item.note = dto.note || null;
    if (dto.recurrenceType !== undefined)
      item.recurrenceType = dto.recurrenceType || null;
    if (dto.recurrenceUntilYear !== undefined)
      item.recurrenceUntilYear = dto.recurrenceUntilYear
        ? Number(dto.recurrenceUntilYear)
        : null;
    if (dto.recurrenceUntilMonth !== undefined)
      item.recurrenceUntilMonth = dto.recurrenceUntilMonth
        ? Number(dto.recurrenceUntilMonth)
        : null;
    if (dto.recurrenceAnchorId !== undefined)
      item.recurrenceAnchorId = dto.recurrenceAnchorId || null;

    const updated = await this.opexRepo.save(item);
    return {
      ...updated,
      amount: Number(updated.amount) || 0,
      ojAmount: Number(updated.ojAmount) || 0,
      period: `${String(updated.periodMonth).padStart(2, '0')}/${updated.periodYear}`,
    };
  }

  /**
   * Áp dụng thay đổi định kỳ (Google Calendar style: this vs this_and_future)
   */
  async applyRecurring(
    id: string,
    dto: import('../dto/garage-opex.dto').ApplyRecurringOpexDto,
    userId?: string,
  ) {
    const item = await this.opexRepo.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException(`Chi phí vận hành ${id} không tồn tại`);
    }

    if (dto.amount !== undefined) item.amount = Number(dto.amount) || 0;
    if (dto.ojAmount !== undefined) item.ojAmount = Number(dto.ojAmount) || 0;
    if (dto.categoryKey !== undefined) item.categoryKey = dto.categoryKey;
    if (dto.categoryName !== undefined) item.categoryName = dto.categoryName;
    if (dto.note !== undefined) item.note = dto.note || null;
    if (dto.recurrenceType !== undefined)
      item.recurrenceType = dto.recurrenceType || null;
    if (dto.untilYear !== undefined)
      item.recurrenceUntilYear = dto.untilYear ? Number(dto.untilYear) : null;
    if (dto.untilMonth !== undefined)
      item.recurrenceUntilMonth = dto.untilMonth
        ? Number(dto.untilMonth)
        : null;

    const saved = await this.opexRepo.save(item);

    if (dto.applyScope === 'this') {
      return {
        updated: 1,
        created: 0,
        total: 1,
        item: {
          ...saved,
          amount: Number(saved.amount) || 0,
          ojAmount: Number(saved.ojAmount) || 0,
          period: `${String(saved.periodMonth).padStart(2, '0')}/${saved.periodYear}`,
        },
      };
    }

    // Apply for this and all future periods in recurrence range
    const anchorId = item.recurrenceAnchorId || item.id;
    let startYear = Number(item.periodYear);
    let startMonth = Number(item.periodMonth) + 1;
    if (startMonth > 12) {
      startMonth = 1;
      startYear += 1;
    }

    const endYear = dto.untilYear
      ? Number(dto.untilYear)
      : item.recurrenceUntilYear
        ? Number(item.recurrenceUntilYear)
        : item.periodYear + 1;
    const endMonth = dto.untilMonth
      ? Number(dto.untilMonth)
      : item.recurrenceUntilMonth
        ? Number(item.recurrenceUntilMonth)
        : item.periodMonth;

    const periods: Array<{ year: number; month: number }> = [];
    let curY = startYear;
    let curM = startMonth;
    while (curY < endYear || (curY === endYear && curM <= endMonth)) {
      periods.push({ year: curY, month: curM });
      curM++;
      if (curM > 12) {
        curM = 1;
        curY++;
      }
    }

    let updatedCount = 0;
    let createdCount = 0;

    for (const p of periods) {
      const existing = await this.opexRepo.findOne({
        where: {
          periodYear: p.year,
          periodMonth: p.month,
          categoryKey: item.categoryKey,
        },
      });

      if (existing) {
        existing.amount = item.amount;
        existing.ojAmount = item.ojAmount;
        existing.categoryName = item.categoryName;
        existing.note = item.note;
        existing.recurrenceType = item.recurrenceType;
        existing.recurrenceUntilYear = item.recurrenceUntilYear;
        existing.recurrenceUntilMonth = item.recurrenceUntilMonth;
        existing.recurrenceAnchorId = anchorId;
        await this.opexRepo.save(existing);
        updatedCount++;
      } else {
        const newItem = this.opexRepo.create({
          periodYear: p.year,
          periodMonth: p.month,
          categoryKey: item.categoryKey,
          categoryName: item.categoryName,
          amount: item.amount,
          ojAmount: item.ojAmount,
          note: item.note,
          recurrenceType: item.recurrenceType,
          recurrenceUntilYear: item.recurrenceUntilYear,
          recurrenceUntilMonth: item.recurrenceUntilMonth,
          recurrenceAnchorId: anchorId,
          createdBy: userId || null,
        });
        await this.opexRepo.save(newItem);
        createdCount++;
      }
    }

    return {
      updated: updatedCount + 1, // include current record
      created: createdCount,
      total: updatedCount + 1 + createdCount,
      item: {
        ...saved,
        amount: Number(saved.amount) || 0,
        ojAmount: Number(saved.ojAmount) || 0,
        period: `${String(saved.periodMonth).padStart(2, '0')}/${saved.periodYear}`,
      },
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
      ojAmount: number;
      note?: string | null;
    }> = [];

    const commissionItems: Array<{
      id: string;
      categoryKey: string;
      categoryName: string;
      amount: number;
      ojAmount: number;
      note?: string | null;
    }> = [];

    const directCostItems: Array<{
      id: string;
      categoryKey: string;
      categoryName: string;
      amount: number;
      ojAmount: number;
      note?: string | null;
    }> = [];

    let totalOpex = 0;
    let ojTotalOpex = 0;
    let totalCommission = 0;
    let ojTotalCommission = 0;
    let totalDirectCost = 0;
    let ojTotalDirectCost = 0;

    for (const item of items) {
      const amt = Number(item.amount) || 0;
      const ojAmt = Number(item.ojAmount) || 0;
      const row = {
        id: item.id,
        categoryKey: item.categoryKey,
        categoryName: item.categoryName,
        amount: amt,
        ojAmount: ojAmt,
        note: item.note,
      };

      if (
        item.categoryKey === 'HOA_HONG_TRUC_TIEP' ||
        item.categoryKey === 'CHI_PHI_TRUC_TIEP_KHAC'
      ) {
        directCostItems.push(row);
        totalDirectCost += amt;
        ojTotalDirectCost += ojAmt;
      } else if (item.categoryKey.startsWith('HOA_HONG_')) {
        commissionItems.push(row);
        totalCommission += amt;
        ojTotalCommission += ojAmt;
      } else {
        opexItems.push(row);
        totalOpex += amt;
        ojTotalOpex += ojAmt;
      }
    }

    return {
      directCost: {
        total: totalDirectCost,
        ojTotal: ojTotalDirectCost,
        items: directCostItems,
      },
      opex: {
        total: totalOpex,
        ojTotal: ojTotalOpex,
        items: opexItems,
      },
      commission: {
        total: totalCommission,
        ojTotal: ojTotalCommission,
        items: commissionItems,
      },
    };
  }
}
