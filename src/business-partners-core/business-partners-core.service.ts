import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { PaginationDto } from '../common/dto/pagination.dto';
import {
  applyMultiKeywordFilter,
  applyMultiKeywordMultiFieldFilter,
} from '../common/utils/query-builder.util';
import { resolveSortOrder } from '../common/utils/sort.util';
import { ErpBusinessPartner } from './entities/erp_business_partner.entity';
import { CreateBusinessPartnerDto } from './dto/create-business-partner.dto';
import { UpdateBusinessPartnerDto } from './dto/update-business-partner.dto';

@Injectable()
export class BusinessPartnersCoreService {
  constructor(
    @InjectRepository(ErpBusinessPartner)
    private readonly repository: Repository<ErpBusinessPartner>,
  ) {}

  private mapColumnToSqlField(column: string): string | null {
    const map: Record<string, string> = {
      code: 'bp.code',
      name: 'bp.name',
      displayName: 'bp.displayName',
      display_name: 'bp.displayName',
      taxCode: 'bp.taxCode',
      tax_code: 'bp.taxCode',
      phone: 'bp.phone',
      email: 'bp.email',
      address: 'bp.address',
      contactName: 'bp.contactName',
      contact_name: 'bp.contactName',
      status: 'bp.status',
      partnerType: 'bp.partnerType',
      partner_type: 'bp.partnerType',
      createdAt: "TO_CHAR(bp.createdAt, 'YYYY-MM-DD')",
      created_at: "TO_CHAR(bp.createdAt, 'YYYY-MM-DD')",
    };
    return map[column] ?? null;
  }

  async create(dto: CreateBusinessPartnerDto) {
    const entity = this.repository.create(dto as any);
    const data = await this.repository.save(entity);
    return { message: 'Tạo thành công', data };
  }

  async findAll(query: PaginationDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.max(1, Number(query.pageSize) || 20);

    const qb = this.repository.createQueryBuilder('bp');
    qb.where('bp.isDeleted = false');

    if (query.partnerType) {
      qb.andWhere('bp.partnerType = :partnerType', {
        partnerType: query.partnerType,
      });
    }

    if (query.status) {
      qb.andWhere('bp.status = :status', { status: query.status });
    }

    // Global fuzzy search across all common identity fields
    if (query.search && query.search.trim()) {
      applyMultiKeywordMultiFieldFilter(
        qb,
        [
          'bp.code',
          'bp.name',
          'bp.displayName',
          'bp.taxCode',
          'bp.phone',
          'bp.email',
          'bp.contactName',
        ],
        query.search.trim(),
        'global_search',
      );
    }

    // Column search (exact "" and multi-keyword ;)
    if (query.column_search) {
      try {
        const searches: Record<string, string> =
          typeof query.column_search === 'string'
            ? JSON.parse(query.column_search)
            : query.column_search;
        Object.entries(searches).forEach(([key, val], idx) => {
          if (val && typeof val === 'string' && val.trim()) {
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
        });
      } catch (e) {
        // Ignore JSON parse errors
      }
    }

    // Column filters (multi-checkbox and blank option)
    if (query.column_filters) {
      try {
        const filters: Record<string, string[]> =
          typeof query.column_filters === 'string'
            ? JSON.parse(query.column_filters)
            : query.column_filters;
        Object.entries(filters).forEach(([key, values], idx) => {
          if (Array.isArray(values) && values.length > 0) {
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
                      .orWhere(`(${sqlField} IS NULL OR ${sqlField} = '')`);
                  }),
                );
              } else if (hasBlank) {
                qb.andWhere(`(${sqlField} IS NULL OR ${sqlField} = '')`);
              } else {
                qb.andWhere(`${sqlField} IN (:...${pName})`, {
                  [pName]: nonBlankValues,
                });
              }
            }
          }
        });
      } catch (e) {
        // Ignore JSON parse errors
      }
    }

    // Date range filters for createdAt
    const dateFrom = (query as any).date_from || (query as any).dateFrom;
    const dateTo = (query as any).date_to || (query as any).dateTo;
    if (dateFrom) {
      qb.andWhere('bp.createdAt >= :dateFrom', {
        dateFrom: new Date(`${dateFrom}T00:00:00.000+07:00`),
      });
    }
    if (dateTo) {
      qb.andWhere('bp.createdAt <= :dateTo', {
        dateTo: new Date(`${dateTo}T23:59:59.999+07:00`),
      });
    }

    // Sorting
    const allowedSortFields: Record<string, string> = {
      createdAt: 'bp.createdAt',
      created_at: 'bp.createdAt',
      code: 'bp.code',
      name: 'bp.name',
      displayName: 'bp.displayName',
      display_name: 'bp.displayName',
      taxCode: 'bp.taxCode',
      tax_code: 'bp.taxCode',
      phone: 'bp.phone',
      email: 'bp.email',
      contactName: 'bp.contactName',
      contact_name: 'bp.contactName',
      status: 'bp.status',
      partnerType: 'bp.partnerType',
      partner_type: 'bp.partnerType',
    };

    if (query.sortField && allowedSortFields[query.sortField]) {
      const dir = query.sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      qb.orderBy(allowedSortFields[query.sortField], dir);
    } else if (query.sort) {
      const order = resolveSortOrder(query.sort, {
        allowedFields: Object.keys(allowedSortFields),
        columnMap: {
          created_at: 'createdAt',
          display_name: 'displayName',
          partner_type: 'partnerType',
          tax_code: 'taxCode',
          contact_name: 'contactName',
        },
        defaultOrder: { createdAt: 'DESC' },
      });
      Object.entries(order).forEach(([col, dir], index) => {
        const sqlCol = allowedSortFields[col] || `bp.${col}`;
        if (index === 0) {
          qb.orderBy(sqlCol, dir as 'ASC' | 'DESC');
        } else {
          qb.addOrderBy(sqlCol, dir as 'ASC' | 'DESC');
        }
      });
    } else {
      qb.orderBy('bp.createdAt', 'DESC');
    }

    qb.skip((page - 1) * pageSize).take(pageSize);

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getColumnOptions(
    column: string,
    search?: string,
    page: number = 1,
    pageSize: number = 20,
    filtersStr?: string,
    partnerType?: string,
  ) {
    const rawSqlField = this.mapColumnToSqlField(column);
    if (!rawSqlField) {
      return { items: [], total: 0, next: null };
    }

    const qb = this.repository.createQueryBuilder('bp');
    qb.where('bp.isDeleted = false');

    if (partnerType) {
      qb.andWhere('bp.partnerType = :partnerType', { partnerType });
    }

    // Apply cross-column filters if provided
    if (filtersStr) {
      try {
        const filters: Record<string, string[]> =
          typeof filtersStr === 'string' ? JSON.parse(filtersStr) : filtersStr;
        Object.entries(filters).forEach(([key, values], idx) => {
          if (key !== column && Array.isArray(values) && values.length > 0) {
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
                      .orWhere(`(${sqlField} IS NULL OR ${sqlField} = '')`);
                  }),
                );
              } else if (hasBlank) {
                qb.andWhere(`(${sqlField} IS NULL OR ${sqlField} = '')`);
              } else {
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

    // Select distinct value and count
    qb.select(`${rawSqlField}`, 'value');
    qb.addSelect('COUNT(*)', 'count');
    qb.andWhere(`${rawSqlField} IS NOT NULL AND ${rawSqlField} != ''`);

    if (search && search.trim()) {
      applyMultiKeywordFilter(qb, rawSqlField, search.trim(), 'col_opt_search');
    }

    qb.groupBy(`${rawSqlField}`);
    qb.orderBy(`${rawSqlField}`, 'ASC');

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

  async findOne(id: string) {
    const data = await this.repository.findOneByOrFail({
      id,
      isDeleted: false,
    });
    return { message: 'Lấy thông tin thành công', data };
  }

  async update(id: string, dto: UpdateBusinessPartnerDto) {
    await this.repository.update(id, dto as any);
    const data = await this.repository.findOneByOrFail({
      id,
      isDeleted: false,
    });
    return { message: 'Cập nhật thành công', data };
  }

  async remove(id: string) {
    const existing = await this.repository.findOneBy({ id });
    if (!existing) {
      throw new NotFoundException(`Business partner ${id} not found`);
    }
    existing.isDeleted = true;
    const data = await this.repository.save(existing);
    return { message: 'Xóa thành công', data };
  }
}
