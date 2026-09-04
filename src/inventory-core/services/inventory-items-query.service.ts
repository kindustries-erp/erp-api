import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import { resolveSortOrder } from '../../common/utils/sort.util';
import {
  applyMultiKeywordFilter,
  applyMultiKeywordMultiFieldFilter,
} from '../../common/utils/query-builder.util';
import { ErpInventoryItem } from '../entities/erp_inventory_item.entity';
import { ErpInventoryBalance } from '../entities/erp_inventory_balance.entity';

@Injectable()
export class InventoryItemsQueryService {
  constructor(
    @InjectRepository(ErpInventoryItem)
    private readonly repository: Repository<ErpInventoryItem>,
    @InjectRepository(ErpInventoryBalance)
    private readonly balanceRepository: Repository<ErpInventoryBalance>,
  ) {}

  private mapColumnToSqlField(col: string): string | null {
    switch (col) {
      case 'sku':
      case 'item_code':
      case 'code':
        return 'item.sku';
      case 'itemName':
      case 'item_name':
      case 'name':
        return 'item.itemName';
      case 'uom':
      case 'uom_name':
      case 'unit':
        return 'uom.name';
      case 'itemType':
      case 'item_type':
        return 'itemType.name';
      case 'trackingPolicy':
      case 'tracking_policy':
        return 'trackingPolicy.name';
      case 'trackingCategory':
      case 'tracking_category':
        return 'trackingCategory.name';
      case 'status':
        return 'item.status';
      case 'createdAt':
      case 'created_at':
        return 'item.createdAt';
      default:
        return null;
    }
  }

  async findAll(query: any) {
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 20;

    const qb = this.repository.createQueryBuilder('item');
    qb.leftJoinAndSelect('item.uom', 'uom');
    qb.leftJoinAndSelect('item.itemType', 'itemType');
    qb.leftJoinAndSelect('item.trackingPolicy', 'trackingPolicy');
    qb.leftJoinAndSelect('item.trackingCategory', 'trackingCategory');
    qb.where('item.isDeleted = false');

    if (query.status) {
      qb.andWhere('item.status = :status', { status: query.status });
    }

    if (query.itemTypeId) {
      qb.andWhere('item.itemTypeId = :itemTypeId', {
        itemTypeId: query.itemTypeId,
      });
    }

    if (query.ids) {
      const idsList = query.ids
        .split(',')
        .map((id: string) => id.trim())
        .filter(Boolean);
      if (idsList.length > 0) {
        qb.andWhere('item.id IN (:...ids)', { ids: idsList });
      }
    }

    // Global search
    if (
      query.search &&
      typeof query.search === 'string' &&
      query.search.trim()
    ) {
      applyMultiKeywordMultiFieldFilter(
        qb,
        ['item.sku', 'item.itemName'],
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
        // Ignore JSON parse error
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
        // Ignore JSON parse error
      }
    }

    if (query.attributes) {
      const attrs = query.attributes.split(',').map((a: string) => a.trim());
      qb.andWhere('item.attributes @> :attrs', { attrs });
    }

    const sortOrder = resolveSortOrder(query.sort, {
      allowedFields: [
        'createdAt',
        'itemName',
        'sku',
        'status',
        'itemTypeId',
        'uom',
        'itemType',
        'trackingPolicy',
      ],
      columnMap: {
        created_at: 'createdAt',
        item_name: 'itemName',
        item_type_id: 'itemTypeId',
        uom: 'uom.name',
        itemType: 'itemType.name',
        trackingPolicy: 'trackingPolicy.name',
      },
      defaultOrder: { 'item.createdAt': 'DESC' },
    });

    Object.entries(sortOrder).forEach(([field, direction], index) => {
      const sqlField = field.includes('.') ? field : `item.${field}`;
      if (index === 0) {
        qb.orderBy(sqlField, direction as 'ASC' | 'DESC');
      } else {
        qb.addOrderBy(sqlField, direction as 'ASC' | 'DESC');
      }
    });

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
  ) {
    const rawSqlField = this.mapColumnToSqlField(column);
    if (!rawSqlField) {
      return { items: [], total: 0, next: null };
    }

    const qb = this.repository.createQueryBuilder('item');
    qb.leftJoin('item.uom', 'uom');
    qb.leftJoin('item.itemType', 'itemType');
    qb.leftJoin('item.trackingPolicy', 'trackingPolicy');
    qb.leftJoin('item.trackingCategory', 'trackingCategory');
    qb.where('item.isDeleted = false');

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
      count: Number(r.count || 0),
    }));

    const totalPages = Math.ceil(total / pageSize);
    const next = page < totalPages ? page + 1 : null;

    return { items, total, next };
  }

  async getBalances(idsString?: string) {
    if (!idsString) return { data: {} };
    const ids = idsString
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    if (!ids.length) return { data: {} };

    const balances = await this.balanceRepository.find({
      where: { itemId: In(ids) } as any,
    });

    const data: Record<string, any> = {};
    for (const b of balances) {
      if (b.itemId) {
        const currentQty = Number(b.qtyOnHand || 0);
        const currentReserved = Number(b.qtyReserved || 0);
        data[b.itemId] = {
          qtyOnHand: currentQty,
          qtyReserved: currentReserved,
          availableQty: currentQty - currentReserved,
        };
      }
    }

    return { data };
  }
}
