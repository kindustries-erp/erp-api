import { SelectQueryBuilder } from 'typeorm';
import { KgaraOperatingExpense } from '../entities/kgara_operating_expense.entity';
import { ListGarageOpexQueryDto } from '../dto/garage-opex.dto';

export const OPEX_GROUP_CATEGORIES = [
  'NHAN_SU',
  'THUE_MAT_BANG',
  'DIEN_NUOC',
  'BAO_TRI',
  'KHAU_HAO',
  'KHAC',
];

export const COGS_GROUP_CATEGORIES = [
  'HOA_HONG_TRUC_TIEP',
  'CHI_PHI_TRUC_TIEP_KHAC',
  'VAT_TU_TIEU_HAO',
];

/** HHBH hiển thị ở mục 4.2 (Chi phí bán hàng) của P&L, nhưng thuộc nhóm Hoa hồng trên màn hình opex. */
export const SELLING_COMMISSION_CATEGORIES = ['HHBH'];

export const COMMISSION_GROUP_CATEGORIES = [
  'HOA_HONG_SALE',
  'HOA_HONG_DV',
  'HOA_HONG_KHAC',
  ...SELLING_COMMISSION_CATEGORIES,
];

function parseMonthYear(
  values: string[],
  prefix: string,
  mCol: string,
  yCol: string,
) {
  const conds: string[] = [];
  const params: Record<string, number> = {};
  values.forEach((p, idx) => {
    const [m, y] = p.split('/').map(Number);
    conds.push(
      `(${mCol} = :${prefix}M_${idx} AND ${yCol} = :${prefix}Y_${idx})`,
    );
    params[`${prefix}M_${idx}`] = m;
    params[`${prefix}Y_${idx}`] = y;
  });
  return { conds, params };
}

/**
 * Áp dụng các điều kiện lọc và tìm kiếm cho danh sách chi phí vận hành
 */
export function applyOpexListFilters(
  qb: SelectQueryBuilder<KgaraOperatingExpense>,
  query: ListGarageOpexQueryDto,
): void {
  if (query.year) {
    qb.andWhere('opex.period_year = :year', { year: Number(query.year) });
  }

  if (query.month) {
    qb.andWhere('opex.period_month = :month', { month: Number(query.month) });
  }

  if (query.date_from) {
    const [fromYear, fromMonth = 1] = query.date_from.split('-').map(Number);
    qb.andWhere(
      '(opex.period_year * 100 + opex.period_month) >= :fromPeriodInt',
      {
        fromPeriodInt: fromYear * 100 + fromMonth,
      },
    );
  }

  if (query.date_to) {
    const [toYear, toMonth = 12] = query.date_to.split('-').map(Number);
    qb.andWhere(
      '(opex.period_year * 100 + opex.period_month) <= :toPeriodInt',
      {
        toPeriodInt: toYear * 100 + toMonth,
      },
    );
  }

  // Filter cost_group (OPEX | COGS | COMMISSION)
  if (query.cost_group && query.cost_group !== 'ALL') {
    if (query.cost_group === 'OPEX') {
      qb.andWhere('opex.category_key NOT IN (:...cogsAndComm)', {
        cogsAndComm: [
          ...COGS_GROUP_CATEGORIES,
          'HOA_HONG_SALE',
          'HOA_HONG_DV',
          'HOA_HONG_KHAC',
        ],
      });
    } else if (query.cost_group === 'COGS') {
      qb.andWhere('opex.category_key IN (:...cogs)', {
        cogs: COGS_GROUP_CATEGORIES,
      });
    } else if (query.cost_group === 'COMMISSION') {
      qb.andWhere('opex.category_key IN (:...comm)', {
        comm: COMMISSION_GROUP_CATEGORIES,
      });
    }
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
          const searchFieldMap: Record<string, string> = {
            categoryKey: 'opex.category_key',
            categoryName: 'opex.category_name',
            note: 'opex.note',
          };
          if (searchFieldMap[col]) {
            qb.andWhere(`${searchFieldMap[col]} ILIKE :allMatch_${col}`, {
              [`allMatch_${col}`]: `%${searchVal}%`,
            });
          }
          continue;
        }

        if (col === 'categoryKey' || col === 'categoryName') {
          const dbKey =
            col === 'categoryKey' ? 'opex.category_key' : 'opex.category_name';
          qb.andWhere(`${dbKey} IN (:...${col}Vals)`, {
            [`${col}Vals`]: values,
          });
        } else if (col === 'costGroup') {
          const targetCats: string[] = [];
          if (values.includes('OPEX'))
            targetCats.push(...OPEX_GROUP_CATEGORIES);
          if (values.includes('COGS'))
            targetCats.push(...COGS_GROUP_CATEGORIES);
          if (values.includes('COMMISSION'))
            targetCats.push(...COMMISSION_GROUP_CATEGORIES);
          if (targetCats.length > 0) {
            qb.andWhere('opex.category_key IN (:...cgCats)', {
              cgCats: targetCats,
            });
          }
        } else if (col === 'amount') {
          const numAmounts = values.map(Number).filter((n) => !Number.isNaN(n));
          if (numAmounts.length > 0) {
            qb.andWhere('opex.amount IN (:...numAmounts)', { numAmounts });
          }
        } else if (col === 'recurrenceType' || col === 'note') {
          const dbField =
            col === 'recurrenceType' ? 'opex.recurrence_type' : 'opex.note';
          const hasBlank = values.includes('__BLANK__');
          const cleanVals = values.filter((v) => v !== '__BLANK__');
          if (hasBlank && cleanVals.length > 0) {
            qb.andWhere(
              `(${dbField} IN (:...${col}V) OR ${dbField} IS NULL OR ${dbField} = '')`,
              {
                [`${col}V`]: cleanVals,
              },
            );
          } else if (hasBlank) {
            qb.andWhere(`(${dbField} IS NULL OR ${dbField} = '')`);
          } else if (cleanVals.length > 0) {
            qb.andWhere(`${dbField} IN (:...${col}V)`, {
              [`${col}V`]: cleanVals,
            });
          }
        } else if (col === 'period') {
          const { conds, params } = parseMonthYear(
            values,
            'p',
            'opex.period_month',
            'opex.period_year',
          );
          if (conds.length > 0) qb.andWhere(`(${conds.join(' OR ')})`, params);
        } else if (col === 'recurrenceUntil') {
          const hasBlank = values.includes('__BLANK__');
          const validPeriods = values.filter((v) => v !== '__BLANK__');
          const { conds, params } = parseMonthYear(
            validPeriods,
            'ru',
            'opex.recurrence_until_month',
            'opex.recurrence_until_year',
          );
          if (hasBlank && conds.length > 0) {
            qb.andWhere(
              `(${conds.join(' OR ')} OR opex.recurrence_until_year IS NULL OR opex.recurrence_until_month IS NULL)`,
              params,
            );
          } else if (hasBlank) {
            qb.andWhere(
              '(opex.recurrence_until_year IS NULL OR opex.recurrence_until_month IS NULL)',
            );
          } else if (conds.length > 0) {
            qb.andWhere(`(${conds.join(' OR ')})`, params);
          }
        }
      }
    } catch {
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
      const colFieldMap: Record<string, string> = {
        categoryKey: 'opex.category_key',
        categoryName: 'opex.category_name',
        amount: 'CAST(opex.amount AS TEXT)',
        note: 'opex.note',
        recurrenceType: 'opex.recurrence_type',
      };
      for (const [col, val] of Object.entries(searches)) {
        if (!val || !val.trim() || !colFieldMap[col]) continue;
        qb.andWhere(`${colFieldMap[col]} ILIKE :cSearch_${col}`, {
          [`cSearch_${col}`]: `%${val.trim()}%`,
        });
      }
    } catch {
      // ignore parse error
    }
  }
}

/**
 * Áp dụng thứ tự sắp xếp cho danh sách chi phí vận hành
 */
export function applyOpexListSorting(
  qb: SelectQueryBuilder<KgaraOperatingExpense>,
  sorts?: string | string[],
): void {
  const sortList = Array.isArray(sorts) ? sorts : sorts ? [sorts] : [];
  if (sortList.length > 0) {
    const fieldMap: Record<string, string> = {
      categoryKey: 'opex.category_key',
      categoryName: 'opex.category_name',
      amount: 'opex.amount',
      recurrenceType: 'opex.recurrence_type',
      note: 'opex.note',
      createdAt: 'opex.created_at',
    };
    for (const s of sortList) {
      const isDesc = s.startsWith('-');
      const field = isDesc ? s.substring(1) : s;
      const dir = isDesc ? 'DESC' : 'ASC';

      if (field === 'period' || field === 'periodYear') {
        qb.addOrderBy('opex.period_year', dir).addOrderBy(
          'opex.period_month',
          dir,
        );
      } else if (
        field === 'recurrenceUntil' ||
        field === 'recurrenceUntilYear'
      ) {
        qb.addOrderBy('opex.recurrence_until_year', dir).addOrderBy(
          'opex.recurrence_until_month',
          dir,
        );
      } else if (fieldMap[field]) {
        qb.addOrderBy(fieldMap[field], dir);
      }
    }
  } else {
    // Default sorting: periodYear DESC, periodMonth DESC, createdAt DESC
    qb.orderBy('opex.period_year', 'DESC')
      .addOrderBy('opex.period_month', 'DESC')
      .addOrderBy('opex.created_at', 'DESC');
  }
}

/**
 * Cấu hình query trích xuất danh sách options duy nhất cho cột
 */
export function buildOpexColumnOptionsQuery(
  qb: SelectQueryBuilder<KgaraOperatingExpense>,
  columnKey: string,
  search?: string,
  filtersStr?: string,
): { fieldAlias: string } {
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
    } catch {
      // ignore parse error
    }
  }

  const distinctFieldMap: Record<string, string> = {
    categoryKey: 'opex.category_key',
    categoryName: 'opex.category_name',
    period: `LPAD(opex.period_month::text, 2, '0') || '/' || opex.period_year::text`,
    recurrenceType: 'opex.recurrence_type',
    recurrenceUntil: `LPAD(opex.recurrence_until_month::text, 2, '0') || '/' || opex.recurrence_until_year::text`,
    amount: 'opex.amount::text',
    note: 'opex.note',
  };
  const distinctField = distinctFieldMap[columnKey] || 'opex.category_name';
  const fieldAlias = 'value';

  qb.select(`DISTINCT (${distinctField})`, fieldAlias);

  if (search && search.trim()) {
    qb.andWhere(`${distinctField} ILIKE :search`, {
      search: `%${search.trim()}%`,
    });
  }

  qb.orderBy(fieldAlias, 'ASC');

  return { fieldAlias };
}
