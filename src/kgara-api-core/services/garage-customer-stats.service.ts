import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KgaraCase } from '../entities/kgara_case.entity';

@Injectable()
export class GarageCustomerStatsService {
  private readonly logger = new Logger(GarageCustomerStatsService.name);

  constructor(
    @InjectRepository(KgaraCase)
    private readonly caseRepo: Repository<KgaraCase>,
  ) {}

  /**
   * 4. Lấy danh sách khách hàng và công nợ (Customer Stats & Debt) theo Ngày hoàn thành
   */
  async getCustomersStats(
    page: number = 1,
    pageSize: number = 20,
    search?: string,
    dateFrom?: string,
    dateTo?: string,
    sortBy?: string,
    sortOrder?: 'ASC' | 'DESC',
    columnSearch?: string,
    columnFilters?: string,
  ) {
    const customerQuery = `
      SELECT 
        COALESCE(NULLIF(c.khach_hang_code, ''), NULLIF(c.khach_hang_name, ''), 'KH_LE') as "customerCode",
        MAX(c.khach_hang_name) as "customerName",
        MAX(c.bien_so_xe) as "latestLicensePlate",
        SUM(COALESCE(gp.doanh_thu, c.doanh_thu, c.tien_co_thue, 0)) as "totalRevenue",
        SUM(COALESCE(gp.chi_phi, c.chi_phi, 0)) as "totalCost",
        SUM(COALESCE(gp.loi_nhuan, c.loi_nhuan, COALESCE(gp.doanh_thu, c.doanh_thu, c.tien_co_thue, 0) - COALESCE(gp.chi_phi, c.chi_phi, 0), 0)) as "totalProfit",
        SUM(COALESCE(c.tien_da_thanh_toan, 0)) as "paidAmount",
        SUM(COALESCE(c.tien_con_phai_thanh_toan, 0)) as "receivableAmount",
        COUNT(c.id) as "caseCount",
        MAX(c.ngay_hoan_thanh_cong_viec) as "lastVisitDate"
      FROM kgara_cases c
      LEFT JOIN kgara_gross_profit gp ON gp.hd_phieu_dich_vu_id = c.hd_phieu_dich_vu_id OR gp.vu_viec_code = c.so_chung_tu
      WHERE c.kgara_deleted_at IS NULL 
        AND (c.tinh_trang_dich_vu IS NULL OR c.tinh_trang_dich_vu != 9)
        AND c.ngay_hoan_thanh_cong_viec IS NOT NULL
        ${dateFrom ? `AND c.ngay_hoan_thanh_cong_viec >= '${dateFrom}'` : ''}
        ${dateTo ? `AND c.ngay_hoan_thanh_cong_viec <= '${dateTo.length === 10 ? dateTo + ' 23:59:59.999' : dateTo}'` : ''}
      GROUP BY COALESCE(NULLIF(c.khach_hang_code, ''), NULLIF(c.khach_hang_name, ''), 'KH_LE')
      HAVING COALESCE(NULLIF(c.khach_hang_code, ''), NULLIF(c.khach_hang_name, ''), 'KH_LE') IS NOT NULL
    `;

    let finalQuery = `SELECT * FROM (${customerQuery}) cust`;
    const whereConditions: string[] = [];

    if (search) {
      const s = search.replace(/'/g, "''");
      whereConditions.push(
        `(cust."customerCode" ILIKE '%${s}%' OR cust."customerName" ILIKE '%${s}%' OR cust."latestLicensePlate" ILIKE '%${s}%')`,
      );
    }

    if (columnSearch) {
      try {
        const cSearch = JSON.parse(columnSearch) as Record<string, string>;
        for (const [col, val] of Object.entries(cSearch)) {
          if (!val) continue;
          const s = val.replace(/'/g, "''");
          if (col === 'customerCode') {
            whereConditions.push(`cust."customerCode" ILIKE '%${s}%'`);
          } else if (col === 'customerName') {
            whereConditions.push(`cust."customerName" ILIKE '%${s}%'`);
          } else if (col === 'latestLicensePlate') {
            whereConditions.push(`cust."latestLicensePlate" ILIKE '%${s}%'`);
          }
        }
      } catch (e) {}
    }

    if (columnFilters) {
      try {
        const cFilters = JSON.parse(columnFilters) as Record<string, string[]>;
        for (const [col, vals] of Object.entries(cFilters)) {
          if (!vals || vals.length === 0) continue;
          const quotedVals = vals
            .map((v) => `'${v.replace(/'/g, "''")}'`)
            .join(', ');
          if (col === 'customerCode') {
            whereConditions.push(`cust."customerCode" IN (${quotedVals})`);
          } else if (col === 'customerName') {
            whereConditions.push(`cust."customerName" IN (${quotedVals})`);
          }
        }
      } catch (e) {}
    }

    if (sortBy === 'receivableAmount') {
      whereConditions.push(`cust."receivableAmount" > 0`);
    }

    if (whereConditions.length > 0) {
      finalQuery += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    const countQuery = `SELECT COUNT(*) as count FROM (${finalQuery}) as t`;
    const countResult = await this.caseRepo.query(countQuery);
    const total = parseInt(countResult[0]?.count || '0', 10);

    let orderClause = `ORDER BY cust."totalRevenue" DESC`;
    if (sortBy === 'receivableAmount') {
      orderClause = `ORDER BY cust."receivableAmount" ${sortOrder || 'DESC'}`;
    } else if (sortBy === 'lastVisitDate') {
      orderClause = `ORDER BY cust."lastVisitDate" ${sortOrder || 'DESC'}`;
    } else if (sortBy) {
      orderClause = `ORDER BY cust."${sortBy}" ${sortOrder || 'DESC'}`;
    }

    const dataQuery = `${finalQuery} ${orderClause} LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`;
    const rawData = await this.caseRepo.query(dataQuery);

    const items = rawData.map((r: any) => {
      const rev = Number(r.totalRevenue) || 0;
      const cost = Number(r.totalCost) || 0;
      const profit = Number(r.totalProfit) || 0;
      const paid = Number(r.paidAmount) || 0;
      const receivable = Number(r.receivableAmount) || 0;

      return {
        customerCode: r.customerCode,
        customerName: r.customerName || 'Khách lẻ',
        latestLicensePlate: r.latestLicensePlate || '-',
        totalRevenue: rev,
        totalCost: cost,
        totalGrossProfit: profit,
        margin: rev > 0 ? (profit / rev) * 100 : 0,
        paidAmount: paid,
        receivableAmount: receivable,
        caseCount: Number(r.caseCount) || 0,
        lastVisitDate: r.lastVisitDate,
      };
    });

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
