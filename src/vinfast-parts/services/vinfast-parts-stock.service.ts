import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VinfastPartsCatalog } from '../entities/vinfast-parts-catalog.entity';
import { VINFAST_CAR_PART_CODES } from '../../reports-core/vinfast-car-part-codes';
import {
  buildRawMultiKeywordSql,
  buildRawColumnFilterSql,
} from '../helpers/vinfast-parts-query.helper';

@Injectable()
export class VinfastPartsStockService {
  private readonly logger = new Logger(VinfastPartsStockService.name);

  constructor(
    @InjectRepository(VinfastPartsCatalog)
    private readonly catalogRepo: Repository<VinfastPartsCatalog>,
  ) {}

  private getCarCodesSqlList(): string {
    const carCodes = VINFAST_CAR_PART_CODES.flatMap((c) => [
      c,
      c.startsWith('VF-') ? c : `VF-${c}`,
    ]);
    return carCodes.map((c) => `'${c}'`).join(',');
  }

  async getPartsStock(
    vehicleType?: string,
    page: number = 1,
    limit: number = 50,
    search?: string,
    sortBy?: string,
    sortDir?: string,
    sorts?: string,
    columnSearch?: string,
    columnFilters?: string,
    stockTab?: string,
  ) {
    const carCodesStr = this.getCarCodesSqlList();
    const params: any[] = [];
    let paramIndex = 1;

    let vehicleTypeFilter = '';
    if (vehicleType) {
      if (vehicleType === 'oto' || vehicleType === 'CAR') {
        vehicleTypeFilter = ` AND c.sku IN (${carCodesStr})`;
      } else if (vehicleType === 'xemay' || vehicleType === 'MOTORBIKE') {
        vehicleTypeFilter = ` AND c.sku NOT IN (${carCodesStr})`;
      }
    }

    let searchFilter = '';
    if (search) {
      searchFilter += ` AND (c.sku ILIKE $${paramIndex} OR c.name ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    let cSearchFilter = '';
    let havingSearchFilter = '';
    if (columnSearch) {
      try {
        const parsed = JSON.parse(columnSearch);
        for (const [col, val] of Object.entries(parsed)) {
          if (!val) continue;
          const strVal = typeof val === 'string' ? val : JSON.stringify(val);
          if (col === 'sku') {
            const res = buildRawMultiKeywordSql(
              'c.sku',
              strVal,
              paramIndex,
              params,
            );
            cSearchFilter += res.sql;
            paramIndex = res.nextIndex;
          } else if (col === 'name') {
            const res = buildRawMultiKeywordSql(
              'c.name',
              strVal,
              paramIndex,
              params,
            );
            cSearchFilter += res.sql;
            paramIndex = res.nextIndex;
          } else if (col === 'uom') {
            const res = buildRawMultiKeywordSql(
              'c.uom',
              strVal,
              paramIndex,
              params,
            );
            cSearchFilter += res.sql;
            paramIndex = res.nextIndex;
          } else if (['qtyIn', 'qtyOut', 'qtyBalance'].includes(col)) {
            const res = buildRawMultiKeywordSql(
              `CAST("${col}" AS TEXT)`,
              strVal,
              paramIndex,
              params,
            );
            havingSearchFilter += res.sql;
            paramIndex = res.nextIndex;
          }
        }
      } catch (e) {}
    }

    let cFiltersSql = '';
    let havingFiltersSql = '';
    if (columnFilters) {
      try {
        const parsed = JSON.parse(columnFilters);
        for (const [col, vals] of Object.entries(parsed)) {
          const arr = vals as string[];
          if (!arr || arr.length === 0) continue;
          if (col === 'sku') {
            const res = buildRawColumnFilterSql(
              'c.sku',
              arr,
              paramIndex,
              params,
            );
            cFiltersSql += res.sql;
            paramIndex = res.nextIndex;
          } else if (col === 'name') {
            const res = buildRawColumnFilterSql(
              'c.name',
              arr,
              paramIndex,
              params,
            );
            cFiltersSql += res.sql;
            paramIndex = res.nextIndex;
          } else if (col === 'uom') {
            const res = buildRawColumnFilterSql(
              'c.uom',
              arr,
              paramIndex,
              params,
            );
            cFiltersSql += res.sql;
            paramIndex = res.nextIndex;
          } else if (col === 'vehicleType') {
            const isCar = arr.includes('CAR');
            const isMoto = arr.includes('MOTORBIKE');
            if (isCar && !isMoto) {
              cFiltersSql += ` AND c.sku IN (${carCodesStr})`;
            } else if (!isCar && isMoto) {
              cFiltersSql += ` AND c.sku NOT IN (${carCodesStr})`;
            }
          } else if (['qtyIn', 'qtyOut', 'qtyBalance'].includes(col)) {
            const res = buildRawColumnFilterSql(
              `CAST("${col}" AS TEXT)`,
              arr,
              paramIndex,
              params,
            );
            havingFiltersSql += res.sql;
            paramIndex = res.nextIndex;
          }
        }
      } catch (e) {}
    }

    if (stockTab === 'IN_STOCK') {
      havingFiltersSql += ' AND "qtyBalance" > 0';
    } else if (stockTab === 'OUT_OF_STOCK') {
      havingFiltersSql += ' AND "qtyBalance" = 0';
    } else if (stockTab === 'NEGATIVE') {
      havingFiltersSql += ' AND "qtyBalance" < 0';
    } else if (stockTab === 'IN') {
      havingFiltersSql += ' AND "qtyIn" > 0';
    } else if (stockTab === 'OUT') {
      havingFiltersSql += ' AND "qtyOut" > 0';
    }

    let orderSql = 'ORDER BY "qtyBalance" DESC, sku ASC';
    if (sorts) {
      try {
        const parsedSorts = JSON.parse(sorts) as string[];
        if (Array.isArray(parsedSorts) && parsedSorts.length > 0) {
          const sortClauses = parsedSorts.map((s) => {
            const isDesc = s.startsWith('-');
            const field = isDesc ? s.substring(1) : s;
            const dir = isDesc ? 'DESC' : 'ASC';
            if (['qtyIn', 'qtyOut', 'qtyBalance'].includes(field)) {
              return `"${field}" ${dir}`;
            }
            return `c.${field} ${dir}`;
          });
          orderSql = `ORDER BY ${sortClauses.join(', ')}`;
        }
      } catch (e) {}
    } else if (sortBy) {
      const dir = (sortDir || 'ASC').toUpperCase();
      if (['qtyIn', 'qtyOut', 'qtyBalance'].includes(sortBy)) {
        orderSql = `ORDER BY "${sortBy}" ${dir}`;
      } else {
        orderSql = `ORDER BY c.${sortBy} ${dir}`;
      }
    }

    const baseQuery = `
      WITH StockData AS (
        SELECT 
          c.sku, 
          c.name, 
          c.uom, 
          c.is_service as "isService",
          CASE WHEN c.sku IN (${carCodesStr}) THEN 'CAR' ELSE 'MOTORBIKE' END as "vehicleType",
          COALESCE(SUM(CASE WHEN l.direction = 'IN' THEN l.qty ELSE 0 END), 0) as "qtyIn",
          COALESCE(SUM(CASE WHEN l.direction = 'OUT' THEN l.qty ELSE 0 END), 0) as "qtyOut",
          (COALESCE(SUM(CASE WHEN l.direction = 'IN' THEN l.qty ELSE 0 END), 0) - COALESCE(SUM(CASE WHEN l.direction = 'OUT' THEN l.qty ELSE 0 END), 0)) as "qtyBalance"
        FROM vinfast_parts_catalog c
        LEFT JOIN vinfast_parts_ledger l ON l.part_sku = c.sku
        WHERE c.is_service = false ${vehicleTypeFilter} ${searchFilter} ${cSearchFilter} ${cFiltersSql}
        GROUP BY c.sku, c.name, c.uom, c.is_service
      )
    `;

    const dataQuery = `
      ${baseQuery}
      SELECT *
      FROM StockData
      WHERE 1=1 ${havingSearchFilter} ${havingFiltersSql}
      ${orderSql}
      LIMIT ${limit} OFFSET ${(page - 1) * limit}
    `;

    const countQuery = `
      ${baseQuery}
      SELECT COUNT(*) as total
      FROM StockData
      WHERE 1=1 ${havingSearchFilter} ${havingFiltersSql}
    `;

    const summaryQuery = `
      ${baseQuery}
      SELECT 
        COALESCE(SUM("qtyIn"), 0) as "totalQtyIn",
        COALESCE(SUM("qtyOut"), 0) as "totalQtyOut",
        COALESCE(SUM("qtyBalance"), 0) as "totalQtyBalance"
      FROM StockData
      WHERE 1=1 ${havingSearchFilter} ${havingFiltersSql}
    `;

    const [items, countResult, summaryResult] = await Promise.all([
      this.catalogRepo.query(dataQuery, params),
      this.catalogRepo.query(countQuery, params),
      this.catalogRepo.query(summaryQuery, params),
    ]);

    const total = parseInt(countResult[0]?.total || '0', 10);
    const totalPages = Math.ceil(total / limit);

    let cumulativeQtyIn = 0;
    let cumulativeQtyOut = 0;
    let cumulativeQtyBalance = 0;

    if (page === 1) {
      for (const item of items) {
        cumulativeQtyIn += Number(item.qtyIn || 0);
        cumulativeQtyOut += Number(item.qtyOut || 0);
        cumulativeQtyBalance += Number(item.qtyBalance || 0);
      }
    } else if (page > 1 && page < totalPages) {
      const cumulativeLimit = page * limit;
      const cumulativeQuery = `
        ${baseQuery}
        , PagedStock AS (
          SELECT *
          FROM StockData
          WHERE 1=1 ${havingSearchFilter} ${havingFiltersSql}
          ${orderSql}
          LIMIT ${cumulativeLimit}
        )
        SELECT 
          COALESCE(SUM("qtyIn"), 0) as "cumulativeQtyIn",
          COALESCE(SUM("qtyOut"), 0) as "cumulativeQtyOut",
          COALESCE(SUM("qtyBalance"), 0) as "cumulativeQtyBalance"
        FROM PagedStock
      `;
      const cumResult = await this.catalogRepo.query(cumulativeQuery, params);
      cumulativeQtyIn = Number(cumResult[0]?.cumulativeQtyIn || 0);
      cumulativeQtyOut = Number(cumResult[0]?.cumulativeQtyOut || 0);
      cumulativeQtyBalance = Number(cumResult[0]?.cumulativeQtyBalance || 0);
    } else if (page >= totalPages) {
      cumulativeQtyIn = Number(summaryResult[0]?.totalQtyIn || 0);
      cumulativeQtyOut = Number(summaryResult[0]?.totalQtyOut || 0);
      cumulativeQtyBalance = Number(summaryResult[0]?.totalQtyBalance || 0);
    }

    return {
      items,
      data: items,
      total,
      page,
      limit,
      totalPages,
      summary: {
        totalQtyIn: Number(summaryResult[0]?.totalQtyIn || 0),
        totalQtyOut: Number(summaryResult[0]?.totalQtyOut || 0),
        totalQtyBalance: Number(summaryResult[0]?.totalQtyBalance || 0),
      },
      cumulative: {
        cumulativeQtyIn,
        cumulativeQtyOut,
        cumulativeQtyBalance,
      },
    };
  }

  async getStockColumnOptions(
    columnKey: string,
    vehicleType?: string,
    search?: string,
    page: number = 1,
    limit: number = 50,
    columnFilters?: string,
    stockTab?: string,
  ) {
    const carCodesStr = this.getCarCodesSqlList();
    const params: any[] = [];
    let paramIndex = 1;

    let vehicleTypeFilter = '';
    if (vehicleType) {
      if (vehicleType === 'oto' || vehicleType === 'CAR') {
        vehicleTypeFilter = ` AND c.sku IN (${carCodesStr})`;
      } else if (vehicleType === 'xemay' || vehicleType === 'MOTORBIKE') {
        vehicleTypeFilter = ` AND c.sku NOT IN (${carCodesStr})`;
      }
    }

    let cFiltersSql = '';
    let havingFiltersSql = '';
    if (columnFilters) {
      try {
        const parsed = JSON.parse(columnFilters);
        for (const [col, vals] of Object.entries(parsed)) {
          const arr = vals as string[];
          if (!arr || arr.length === 0) continue;
          if (col !== columnKey) {
            if (col === 'sku') {
              const res = buildRawColumnFilterSql(
                'c.sku',
                arr,
                paramIndex,
                params,
              );
              cFiltersSql += res.sql;
              paramIndex = res.nextIndex;
            } else if (col === 'name') {
              const res = buildRawColumnFilterSql(
                'c.name',
                arr,
                paramIndex,
                params,
              );
              cFiltersSql += res.sql;
              paramIndex = res.nextIndex;
            } else if (col === 'uom') {
              const res = buildRawColumnFilterSql(
                'c.uom',
                arr,
                paramIndex,
                params,
              );
              cFiltersSql += res.sql;
              paramIndex = res.nextIndex;
            } else if (['qtyIn', 'qtyOut', 'qtyBalance'].includes(col)) {
              const res = buildRawColumnFilterSql(
                `CAST("${col}" AS TEXT)`,
                arr,
                paramIndex,
                params,
              );
              havingFiltersSql += res.sql;
              paramIndex = res.nextIndex;
            }
          }
        }
      } catch (e) {}
    }

    let searchSql = '';
    let havingSearchSql = '';
    if (search) {
      if (columnKey === 'sku') {
        const res = buildRawMultiKeywordSql(
          'c.sku',
          search,
          paramIndex,
          params,
        );
        searchSql += res.sql;
        paramIndex = res.nextIndex;
      } else if (columnKey === 'name') {
        const res = buildRawMultiKeywordSql(
          'c.name',
          search,
          paramIndex,
          params,
        );
        searchSql += res.sql;
        paramIndex = res.nextIndex;
      } else if (columnKey === 'uom') {
        const res = buildRawMultiKeywordSql(
          'c.uom',
          search,
          paramIndex,
          params,
        );
        searchSql += res.sql;
        paramIndex = res.nextIndex;
      } else if (['qtyIn', 'qtyOut', 'qtyBalance'].includes(columnKey)) {
        const res = buildRawMultiKeywordSql(
          `CAST("${columnKey}" AS TEXT)`,
          search,
          paramIndex,
          params,
        );
        havingSearchSql += res.sql;
        paramIndex = res.nextIndex;
      }
    }

    if (stockTab === 'IN_STOCK') {
      havingFiltersSql += ' AND "qtyBalance" > 0';
    } else if (stockTab === 'OUT_OF_STOCK') {
      havingFiltersSql += ' AND "qtyBalance" = 0';
    } else if (stockTab === 'NEGATIVE') {
      havingFiltersSql += ' AND "qtyBalance" < 0';
    } else if (stockTab === 'IN') {
      havingFiltersSql += ' AND "qtyIn" > 0';
    } else if (stockTab === 'OUT') {
      havingFiltersSql += ' AND "qtyOut" > 0';
    }

    let selectCol = 'sku';
    if (columnKey === 'name') selectCol = 'name';
    else if (columnKey === 'uom') selectCol = 'uom';
    else if (columnKey === 'sku') selectCol = 'sku';
    else if (['qtyIn', 'qtyOut', 'qtyBalance'].includes(columnKey))
      selectCol = `"${columnKey}"`;

    const baseQuery = `
      WITH StockData AS (
        SELECT 
          c.sku, 
          c.name, 
          c.uom, 
          c.is_service as "isService",
          CASE WHEN c.sku IN (${carCodesStr}) THEN 'CAR' ELSE 'MOTORBIKE' END as "vehicleType",
          COALESCE(SUM(CASE WHEN l.direction = 'IN' THEN l.qty ELSE 0 END), 0) as "qtyIn",
          COALESCE(SUM(CASE WHEN l.direction = 'OUT' THEN l.qty ELSE 0 END), 0) as "qtyOut",
          (COALESCE(SUM(CASE WHEN l.direction = 'IN' THEN l.qty ELSE 0 END), 0) - COALESCE(SUM(CASE WHEN l.direction = 'OUT' THEN l.qty ELSE 0 END), 0)) as "qtyBalance"
        FROM vinfast_parts_catalog c
        LEFT JOIN vinfast_parts_ledger l ON l.part_sku = c.sku
        WHERE c.is_service = false ${vehicleTypeFilter} ${cFiltersSql} ${searchSql}
        GROUP BY c.sku, c.name, c.uom, c.is_service
      )
    `;

    const query = `
      ${baseQuery}
      SELECT DISTINCT CAST(${selectCol} AS TEXT) as value
      FROM StockData
      WHERE 1=1 ${havingFiltersSql} ${havingSearchSql}
      ORDER BY value ASC
      LIMIT ${limit} OFFSET ${(page - 1) * limit}
    `;

    const countQuery = `
      ${baseQuery}
      SELECT COUNT(DISTINCT CAST(${selectCol} AS TEXT)) as total
      FROM StockData
      WHERE 1=1 ${havingFiltersSql} ${havingSearchSql}
    `;

    const [items, countResult] = await Promise.all([
      this.catalogRepo.query(query, params),
      this.catalogRepo.query(countQuery, params),
    ]);

    const total = parseInt(countResult[0]?.total || '0', 10);
    return {
      items: items.map((i: any) => i.value).filter((v: any) => v != null),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
