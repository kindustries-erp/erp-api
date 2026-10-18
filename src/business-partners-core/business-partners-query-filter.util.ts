import { Brackets, SelectQueryBuilder } from 'typeorm';

import { applyMultiKeywordFilter } from '../common/utils/query-builder.util';
import { ErpBusinessPartner } from './entities/erp_business_partner.entity';

export interface PartnerOperatorFilter {
  operator: string;
  value?: string;
  valueTo?: string;
}

export interface PartnerFilterPayload {
  columnFilters?: Record<string, string[]>;
  columnSearch?: Record<string, string>;
  columnOperators?: Record<string, PartnerOperatorFilter>;
  dateRanges?: Record<string, { from?: string; to?: string }>;
}

type ResolveField = (column: string) => string | null;

const toVietnamDate = (value: string | undefined, endOfDay = false) => {
  const normalized = value?.trim() ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const date = new Date(
    `${normalized}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}+07:00`,
  );
  return Number.isNaN(date.getTime()) ? null : date;
};

export const parseFilterRecord = <T>(raw: unknown): T | undefined => {
  if (!raw) return undefined;
  if (typeof raw === 'object') return raw as T;
  if (typeof raw !== 'string') return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as T) : undefined;
  } catch {
    return undefined;
  }
};

const applySelection = (
  qb: SelectQueryBuilder<ErpBusinessPartner>,
  field: string,
  values: string[],
  param: string,
) => {
  const allMatching = values[0] === '__ALL_MATCHING__';
  if (allMatching) {
    if (values[1]?.trim()) applyMultiKeywordFilter(qb, field, values[1], param);
    return;
  }
  const hasBlank = values.includes('__BLANK__');
  const selected = values.filter((v) => v !== '__BLANK__');
  if (hasBlank && selected.length) {
    qb.andWhere(
      new Brackets((nested) =>
        nested
          .where(`${field} IN (:...${param})`, { [param]: selected })
          .orWhere(`(${field} IS NULL OR ${field} = '')`),
      ),
    );
  } else if (hasBlank) {
    qb.andWhere(`(${field} IS NULL OR ${field} = '')`);
  } else if (selected.length) {
    qb.andWhere(`${field} IN (:...${param})`, { [param]: selected });
  }
};

const applyOperator = (
  qb: SelectQueryBuilder<ErpBusinessPartner>,
  field: string,
  filter: PartnerOperatorFilter,
  param: string,
) => {
  const value = filter.value?.trim() ?? '';
  const patterns: Record<string, string> = {
    contains: `%${value}%`,
    not_contains: `%${value}%`,
    starts_with: `${value}%`,
    ends_with: `%${value}`,
    equals: value,
    not_equals: value,
  };
  const start = toVietnamDate(value);
  const end = toVietnamDate(value, true);
  const rangeEnd = toVietnamDate(filter.valueTo, true);
  const dateOperators = ['eq', 'before', 'after', 'between'];
  const textOperators = Object.keys(patterns);

  if (dateOperators.includes(filter.operator) && field !== 'bp.createdAt') {
    return;
  }
  if (textOperators.includes(filter.operator) && field === 'bp.createdAt') {
    return;
  }

  if (filter.operator === 'is_empty') {
    qb.andWhere(`(${field} IS NULL OR ${field} = '')`);
  } else if (filter.operator === 'is_not_empty') {
    qb.andWhere(`(${field} IS NOT NULL AND ${field} != '')`);
  } else if (filter.operator === 'eq' && start && end) {
    qb.andWhere(`${field} BETWEEN :${param}_from AND :${param}_to`, {
      [`${param}_from`]: start,
      [`${param}_to`]: end,
    });
  } else if (filter.operator === 'before' && start) {
    qb.andWhere(`${field} < :${param}`, { [param]: start });
  } else if (filter.operator === 'after' && end) {
    qb.andWhere(`${field} > :${param}`, { [param]: end });
  } else if (filter.operator === 'between' && start && rangeEnd) {
    qb.andWhere(`${field} BETWEEN :${param}_from AND :${param}_to`, {
      [`${param}_from`]: start,
      [`${param}_to`]: rangeEnd,
    });
  } else if (value && filter.operator in patterns) {
    const negative = ['not_contains', 'not_equals'].includes(filter.operator);
    qb.andWhere(`${field} ${negative ? 'NOT ' : ''}ILIKE :${param}`, {
      [param]: patterns[filter.operator],
    });
  }
};

export const applyPartnerFilterPayload = (
  qb: SelectQueryBuilder<ErpBusinessPartner>,
  payload: PartnerFilterPayload,
  resolveField: ResolveField,
  prefix: string,
  exceptColumn?: string,
) => {
  Object.entries(payload.columnSearch ?? {}).forEach(([key, value], index) => {
    const field = key === exceptColumn ? null : resolveField(key);
    if (field && value?.trim()) {
      applyMultiKeywordFilter(
        qb,
        field,
        value.trim(),
        `${prefix}_search_${index}`,
      );
    }
  });
  Object.entries(payload.columnFilters ?? {}).forEach(
    ([key, values], index) => {
      const field = key === exceptColumn ? null : resolveField(key);
      if (field && Array.isArray(values) && values.length) {
        applySelection(qb, field, values, `${prefix}_select_${index}`);
      }
    },
  );
  Object.entries(payload.columnOperators ?? {}).forEach(
    ([key, filter], index) => {
      const field = key === exceptColumn ? null : resolveField(key);
      if (field && filter && typeof filter === 'object') {
        applyOperator(qb, field, filter, `${prefix}_operator_${index}`);
      }
    },
  );
  Object.entries(payload.dateRanges ?? {}).forEach(([key, range], index) => {
    const field = key === exceptColumn ? null : resolveField(key);
    if (field !== 'bp.createdAt' || !range) return;
    const from = toVietnamDate(range.from);
    const to = toVietnamDate(range.to, true);
    if (from) {
      qb.andWhere(`${field} >= :${prefix}_from_${index}`, {
        [`${prefix}_from_${index}`]: from,
      });
    }
    if (to) {
      qb.andWhere(`${field} <= :${prefix}_to_${index}`, {
        [`${prefix}_to_${index}`]: to,
      });
    }
  });
};
