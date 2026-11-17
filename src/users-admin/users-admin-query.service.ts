import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import { CoreUser } from '../users/entities/core-user.entity';
import { ErpEmployee } from '../employees-core/entities/erp_employee.entity';
import {
  applyMultiKeywordFilter,
  applyMultiKeywordMultiFieldFilter,
} from '../common/utils/query-builder.util';
import { ListUsersAdminDto } from './dto/user-admin.dto';
import { toSafeUser } from './helpers/users-admin.mapper';

/** Phần đọc (danh sách, gợi ý giá trị cột) của admin user v1, đọc từ bản sao `core_users`. */
@Injectable()
export class UsersAdminQueryService {
  constructor(
    @InjectRepository(CoreUser)
    private readonly usersRepository: Repository<CoreUser>,
    @InjectRepository(ErpEmployee)
    private readonly employeesRepository: Repository<ErpEmployee>,
  ) {}

  private mapColumnToSqlField(column: string): string | null {
    switch (column) {
      case 'email':
        return 'user.email';
      case 'status':
        return 'user.status';
      case 'employee':
      case 'employeeName':
        return 'emp.fullName';
      case 'employeeCode':
        return 'emp.employeeCode';
      case 'lastLoginAt':
        return 'user.lastLoginAt';
      case 'createdAt':
        return 'user.createdAt';
      default:
        return null;
    }
  }

  async getColumnOptions(
    column: string,
    search?: string,
    page: number = 1,
    pageSize: number = 20,
    filtersStr?: string,
  ) {
    const rawSqlField = this.mapColumnToSqlField(column);
    if (!rawSqlField) {
      return { items: [], total: 0, next: null };
    }

    const qb = this.usersRepository.createQueryBuilder('user');
    qb.leftJoin(ErpEmployee, 'emp', 'emp.id = user.employeeId');

    // Cross-column filters
    if (filtersStr) {
      try {
        const filters: Record<string, string[]> =
          typeof filtersStr === 'string' ? JSON.parse(filtersStr) : filtersStr;
        Object.entries(filters).forEach(([key, values], idx) => {
          if (key !== column && Array.isArray(values) && values.length > 0) {
            // 1. Support __ALL_MATCHING__
            if (values[0] === '__ALL_MATCHING__') {
              const searchStr = (values[1] || '').trim();
              if (searchStr) {
                if (key === 'employee') {
                  applyMultiKeywordMultiFieldFilter(
                    qb,
                    ['emp.fullName', 'emp.employeeCode'],
                    searchStr,
                    `c_opt_flt_all_${idx}`,
                  );
                } else {
                  const sqlField = this.mapColumnToSqlField(key);
                  if (sqlField) {
                    applyMultiKeywordFilter(
                      qb,
                      sqlField,
                      searchStr,
                      `c_opt_flt_all_${idx}`,
                    );
                  }
                }
              }
              return;
            }

            const sqlField = this.mapColumnToSqlField(key);
            if (sqlField) {
              const hasBlank = values.includes('__BLANK__');
              const nonBlankValues = values.filter((v) => v !== '__BLANK__');
              const pName = `c_opt_flt_${idx}`;

              if (hasBlank && nonBlankValues.length > 0) {
                qb.andWhere(
                  new Brackets((sqb) => {
                    sqb
                      .where(`${sqlField} IN (:...${pName})`, {
                        [pName]: nonBlankValues,
                      })
                      .orWhere(
                        `(${sqlField} IS NULL OR CAST(${sqlField} AS text) = '')`,
                      );
                  }),
                );
              } else if (hasBlank) {
                qb.andWhere(
                  `(${sqlField} IS NULL OR CAST(${sqlField} AS text) = '')`,
                );
              } else if (nonBlankValues.length > 0) {
                qb.andWhere(`${sqlField} IN (:...${pName})`, {
                  [pName]: nonBlankValues,
                });
              }
            }
          }
        });
      } catch (e) {
        // Ignore JSON error
      }
    }

    if (column === 'employee') {
      qb.select(
        "COALESCE(emp.fullName || ' (' || emp.employeeCode || ')', emp.fullName, emp.employeeCode)",
        'value',
      );
    } else {
      qb.select(`${rawSqlField}`, 'value');
    }
    qb.addSelect('COUNT(*)', 'count');
    qb.andWhere(
      `${rawSqlField} IS NOT NULL AND CAST(${rawSqlField} AS text) != ''`,
    );

    if (search && search.trim()) {
      if (column === 'employee') {
        applyMultiKeywordMultiFieldFilter(
          qb,
          ['emp.fullName', 'emp.employeeCode'],
          search.trim(),
          'col_opt_search',
        );
      } else {
        applyMultiKeywordFilter(
          qb,
          rawSqlField,
          search.trim(),
          'col_opt_search',
        );
      }
    }

    if (column === 'employee') {
      qb.groupBy(
        "COALESCE(emp.fullName || ' (' || emp.employeeCode || ')', emp.fullName, emp.employeeCode)",
      );
      qb.orderBy(
        "COALESCE(emp.fullName || ' (' || emp.employeeCode || ')', emp.fullName, emp.employeeCode)",
        'ASC',
      );
    } else {
      qb.groupBy(`${rawSqlField}`);
      qb.orderBy(`${rawSqlField}`, 'ASC');
    }

    const countQb = qb.clone();
    const totalRaw = await countQb.getRawMany();
    const total = totalRaw.length;

    qb.offset((page - 1) * pageSize).limit(pageSize);
    const rows = await qb.getRawMany();

    const items = rows.map((r) => ({
      label: String(r.value),
      value: String(r.value),
    }));

    const next = page * pageSize < total ? page + 1 : null;
    return { items, total, next };
  }

  async listUsers(query: ListUsersAdminDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.max(1, Number(query.pageSize) || 20);
    const qb = this.usersRepository.createQueryBuilder('user');
    qb.leftJoin(ErpEmployee, 'emp', 'emp.id = user.employeeId');

    if (query.status) {
      qb.andWhere('user.status = :status', { status: query.status });
    }

    if (query.search && query.search.trim()) {
      applyMultiKeywordMultiFieldFilter(
        qb,
        ['user.email', 'emp.fullName', 'emp.employeeCode'],
        query.search.trim(),
        'global_search',
      );
    }

    if (query.linkedEmployee === true) {
      qb.andWhere('user.employeeId IS NOT NULL');
    }
    if (query.linkedEmployee === false) {
      qb.andWhere('user.employeeId IS NULL');
    }

    // Column Search
    if (query.column_search) {
      try {
        const searches: Record<string, string> =
          typeof query.column_search === 'string'
            ? JSON.parse(query.column_search)
            : query.column_search;
        Object.entries(searches).forEach(([key, val], idx) => {
          if (val && typeof val === 'string' && val.trim()) {
            if (key === 'employee') {
              applyMultiKeywordMultiFieldFilter(
                qb,
                ['emp.fullName', 'emp.employeeCode'],
                val.trim(),
                `col_search_${idx}`,
              );
            } else {
              const sqlField = this.mapColumnToSqlField(key);
              if (sqlField) {
                applyMultiKeywordFilter(
                  qb,
                  sqlField,
                  val.trim(),
                  `col_search_${idx}`,
                );
              }
            }
          }
        });
      } catch (e) {
        // Ignore
      }
    }

    // Column Filters
    if (query.column_filters) {
      try {
        const filters: Record<string, string[]> =
          typeof query.column_filters === 'string'
            ? JSON.parse(query.column_filters)
            : query.column_filters;
        Object.entries(filters).forEach(([key, values], idx) => {
          if (Array.isArray(values) && values.length > 0) {
            // 1. Support __ALL_MATCHING__
            if (values[0] === '__ALL_MATCHING__') {
              const searchStr = (values[1] || '').trim();
              if (searchStr) {
                if (key === 'employee') {
                  applyMultiKeywordMultiFieldFilter(
                    qb,
                    ['emp.fullName', 'emp.employeeCode'],
                    searchStr,
                    `col_filter_all_${idx}`,
                  );
                } else {
                  const sqlField = this.mapColumnToSqlField(key);
                  if (sqlField) {
                    applyMultiKeywordFilter(
                      qb,
                      sqlField,
                      searchStr,
                      `col_filter_all_${idx}`,
                    );
                  }
                }
              }
              return;
            }

            const sqlField = this.mapColumnToSqlField(key);
            if (sqlField) {
              const hasBlank = values.includes('__BLANK__');
              const nonBlankValues = values.filter((v) => v !== '__BLANK__');
              const pName = `col_filter_${idx}`;

              if (hasBlank && nonBlankValues.length > 0) {
                qb.andWhere(
                  new Brackets((sqb) => {
                    sqb
                      .where(`${sqlField} IN (:...${pName})`, {
                        [pName]: nonBlankValues,
                      })
                      .orWhere(
                        `(${sqlField} IS NULL OR CAST(${sqlField} AS text) = '')`,
                      );
                  }),
                );
              } else if (hasBlank) {
                qb.andWhere(
                  `(${sqlField} IS NULL OR CAST(${sqlField} AS text) = '')`,
                );
              } else if (nonBlankValues.length > 0) {
                qb.andWhere(`${sqlField} IN (:...${pName})`, {
                  [pName]: nonBlankValues,
                });
              }
            }
          }
        });
      } catch (e) {
        // Ignore
      }
    }

    // Date range filter
    if (query.date_from) {
      qb.andWhere('user.createdAt >= :dateFrom', { dateFrom: query.date_from });
    }
    if (query.date_to) {
      const dTo =
        query.date_to.length === 10
          ? `${query.date_to} 23:59:59.999`
          : query.date_to;
      qb.andWhere('user.createdAt <= :dateTo', { dateTo: dTo });
    }

    // Sorts
    if (query.sorts) {
      const sortList = Array.isArray(query.sorts) ? query.sorts : [query.sorts];
      let hasOrder = false;
      sortList.forEach((s) => {
        if (typeof s === 'string' && s.trim()) {
          const isDesc = s.startsWith('-');
          const fieldKey = isDesc ? s.substring(1) : s;
          const sqlField = this.mapColumnToSqlField(fieldKey);
          if (sqlField) {
            qb.addOrderBy(sqlField, isDesc ? 'DESC' : 'ASC');
            hasOrder = true;
          }
        }
      });
      if (!hasOrder) {
        qb.orderBy('user.createdAt', 'DESC');
      }
    } else {
      qb.orderBy('user.createdAt', 'DESC');
    }

    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const [rows, total] = await qb.getManyAndCount();
    const employeeIds = rows
      .map((row) => row.employeeId)
      .filter(Boolean) as string[];
    const employees = employeeIds.length
      ? await this.employeesRepository.find({ where: { id: In(employeeIds) } })
      : [];
    const employeeMap = new Map(
      employees.map((employee) => [employee.id, employee]),
    );

    return {
      data: rows.map((row) =>
        toSafeUser(
          row,
          row.employeeId ? (employeeMap.get(row.employeeId) ?? null) : null,
        ),
      ),
      total,
      page,
      pageSize,
    };
  }
}
