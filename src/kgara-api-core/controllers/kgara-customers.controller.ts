import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KgaraCase } from '../entities/kgara_case.entity';
import { KgaraCaseSettlement } from '../entities/kgara_case_settlement.entity';
import { extractNetPayableAmount } from '../kgara-sync.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../../auth/guards/core-rbac.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { ErpResource, ErpAction } from '@/rbac-core/enums';
import { BranchId } from '../decorators/branch-id.decorator';

@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('greenway')
export class KgaraCustomersController {
  constructor(
    @InjectRepository(KgaraCase)
    private readonly caseRepo: Repository<KgaraCase>,
    @InjectRepository(KgaraCaseSettlement)
    private readonly settlementRepo: Repository<KgaraCaseSettlement>,
  ) {}

  @Get('cases/customers-debt')
  @RequirePermissions({ resource: ErpResource.GARAGE, action: ErpAction.READ })
  async getCustomersDebt(
    @BranchId() branchId: string,
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '20',
    @Query('q') q: string = '',
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('sorts') sorts?: string | string[],
    @Query('filtersStr') filtersStr?: string,
    @Query('column_filters') columnFiltersParam?: string,
    @Query('column_search') columnSearchParam?: string,
  ) {
    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const safePageSize = Math.max(parseInt(pageSize, 10) || 20, 1);

    // Mốc bắt đầu theo dõi công nợ: từ 07/2026 (2026-07-01)
    const baselineDate = '2026-07-01';
    const effectiveFrom = from && from > baselineDate ? from : baselineDate;

    const whereConditions: string[] = [
      '"case"."kgara_deleted_at" IS NULL',
      '("case"."tinh_trang_dich_vu" = 3 OR "case"."ten_tinh_trang_dich_vu" = \'Kết thúc\' OR "case"."ten_tinh_trang_dich_vu" ILIKE \'%kết thúc%\' OR "case"."ten_tinh_trang_dich_vu" ILIKE \'%hoàn tất%\')',
    ];
    const queryParams: any[] = [];

    whereConditions.push(
      `"case"."ngay_phat_sinh" >= $${queryParams.length + 1}`,
    );
    queryParams.push(effectiveFrom);

    if (branchId) {
      whereConditions.push(
        `"case"."branch_external_id" = $${queryParams.length + 1}`,
      );
      queryParams.push(branchId);
    }

    if (to) {
      whereConditions.push(
        `"case"."ngay_phat_sinh" <= $${queryParams.length + 1}`,
      );
      queryParams.push(to);
    }

    if (q) {
      const qIdx = queryParams.length + 1;
      whereConditions.push(
        `("case"."khach_hang_code" ILIKE $${qIdx} OR "case"."khach_hang_name" ILIKE $${qIdx} OR "case"."bien_so_xe" ILIKE $${qIdx} OR "case"."so_chung_tu" ILIKE $${qIdx})`,
      );
      queryParams.push(`%${q}%`);
    }

    const havingConditions: string[] = [];
    const combinedFiltersStr = filtersStr || columnFiltersParam;
    if (combinedFiltersStr) {
      try {
        const filters = JSON.parse(combinedFiltersStr) as Record<
          string,
          string[]
        >;
        for (const [col, values] of Object.entries(filters)) {
          if (!values || values.length === 0) continue;

          // 1. Xử lý __ALL_MATCHING__ (Chọn tất cả kết quả tìm kiếm)
          if (values[0] === '__ALL_MATCHING__') {
            const searchVal = (values[1] || '').trim();
            if (!searchVal) continue; // Nếu không có searchVal thì không lọc (giữ toàn bộ data)
            if (col === 'customerCode') {
              whereConditions.push(
                `"case"."khach_hang_code" ILIKE $${queryParams.length + 1}`,
              );
              queryParams.push(`%${searchVal}%`);
            } else if (col === 'customerName') {
              whereConditions.push(
                `"case"."khach_hang_name" ILIKE $${queryParams.length + 1}`,
              );
              queryParams.push(`%${searchVal}%`);
            } else if (col === 'branchName' || col === 'branchExternalId') {
              whereConditions.push(
                `"case"."branch_external_id" ILIKE $${queryParams.length + 1}`,
              );
              queryParams.push(`%${searchVal}%`);
            }
            continue;
          }

          // 2. Xử lý __BLANK__
          const hasBlank = values.includes('__BLANK__');
          const realVals = values.filter((v) => v !== '__BLANK__');

          if (col === 'customerCode') {
            if (hasBlank && realVals.length > 0) {
              whereConditions.push(
                `("case"."khach_hang_code" IS NULL OR "case"."khach_hang_code" = '' OR "case"."khach_hang_code" = ANY($${queryParams.length + 1}))`,
              );
              queryParams.push(realVals);
            } else if (hasBlank) {
              whereConditions.push(
                `("case"."khach_hang_code" IS NULL OR "case"."khach_hang_code" = '')`,
              );
            } else {
              whereConditions.push(
                `"case"."khach_hang_code" = ANY($${queryParams.length + 1})`,
              );
              queryParams.push(realVals);
            }
          } else if (col === 'customerName') {
            if (hasBlank && realVals.length > 0) {
              whereConditions.push(
                `("case"."khach_hang_name" IS NULL OR "case"."khach_hang_name" = '' OR "case"."khach_hang_name" = ANY($${queryParams.length + 1}))`,
              );
              queryParams.push(realVals);
            } else if (hasBlank) {
              whereConditions.push(
                `("case"."khach_hang_name" IS NULL OR "case"."khach_hang_name" = '')`,
              );
            } else {
              whereConditions.push(
                `"case"."khach_hang_name" = ANY($${queryParams.length + 1})`,
              );
              queryParams.push(realVals);
            }
          } else if (col === 'branchName' || col === 'branchExternalId') {
            if (hasBlank && realVals.length > 0) {
              whereConditions.push(
                `("case"."branch_external_id" IS NULL OR "case"."branch_external_id" = '' OR "case"."branch_external_id" = ANY($${queryParams.length + 1}))`,
              );
              queryParams.push(realVals);
            } else if (hasBlank) {
              whereConditions.push(
                `("case"."branch_external_id" IS NULL OR "case"."branch_external_id" = '')`,
              );
            } else {
              whereConditions.push(
                `"case"."branch_external_id" = ANY($${queryParams.length + 1})`,
              );
              queryParams.push(realVals);
            }
          } else if (col === 'paymentProgress') {
            const subConds: string[] = [];
            if (values.includes('PAID')) {
              subConds.push(
                '(COALESCE(SUM("case"."tien_con_phai_thanh_toan"), 0) <= 0 AND COALESCE(SUM("case"."tien_da_thanh_toan"), 0) > 0)',
              );
            }
            if (values.includes('PARTIAL')) {
              subConds.push(
                '(COALESCE(SUM("case"."tien_da_thanh_toan"), 0) > 0 AND COALESCE(SUM("case"."tien_con_phai_thanh_toan"), 0) > 0)',
              );
            }
            if (values.includes('UNPAID')) {
              subConds.push(
                '(COALESCE(SUM("case"."tien_da_thanh_toan"), 0) <= 0 AND COALESCE(SUM("case"."tien_con_phai_thanh_toan"), 0) > 0)',
              );
            }
            if (subConds.length > 0) {
              havingConditions.push(`(${subConds.join(' OR ')})`);
            }
          } else if (col === 'maxAgingDays') {
            const subConds: string[] = [];
            const maxAgingExpr =
              'COALESCE(MAX(CASE WHEN COALESCE("case"."tien_con_phai_thanh_toan", 0) > 0 THEN CURRENT_DATE - DATE(COALESCE("case"."ngay_phat_sinh", now())) ELSE 0 END), 0)';
            if (values.includes('0-30')) {
              subConds.push(`(${maxAgingExpr} <= 30)`);
            }
            if (values.includes('31-60')) {
              subConds.push(`(${maxAgingExpr} BETWEEN 31 AND 60)`);
            }
            if (values.includes('61-90')) {
              subConds.push(`(${maxAgingExpr} BETWEEN 61 AND 90)`);
            }
            if (values.includes('>90')) {
              subConds.push(`(${maxAgingExpr} > 90)`);
            }
            if (subConds.length > 0) {
              havingConditions.push(`(${subConds.join(' OR ')})`);
            }
          } else if (col === 'caseCount') {
            const numVals = values
              .map((v) => parseInt(v, 10))
              .filter((v) => !isNaN(v));
            if (numVals.length > 0) {
              havingConditions.push(
                `COUNT("case"."id")::int = ANY($${queryParams.length + 1})`,
              );
              queryParams.push(numVals);
            }
          } else if (col === 'totalAmount') {
            const subConds: string[] = [];
            const sumExpr = 'COALESCE(SUM("case"."tien_co_thue"), 0)';
            if (values.includes('0-10m')) {
              subConds.push(`(${sumExpr} < 10000000)`);
            }
            if (values.includes('10m-20m')) {
              subConds.push(`(${sumExpr} BETWEEN 10000000 AND 20000000)`);
            }
            if (values.includes('20m-50m')) {
              subConds.push(`(${sumExpr} BETWEEN 20000000 AND 50000000)`);
            }
            if (values.includes('>50m')) {
              subConds.push(`(${sumExpr} > 50000000)`);
            }
            if (subConds.length > 0) {
              havingConditions.push(`(${subConds.join(' OR ')})`);
            }
          }
        }
      } catch {
        // ignore
      }
    }

    if (columnSearchParam) {
      try {
        const searchObj = JSON.parse(columnSearchParam) as Record<
          string,
          string
        >;
        for (const [col, val] of Object.entries(searchObj)) {
          if (!val || !val.trim()) continue;
          if (col === 'customerCode') {
            whereConditions.push(
              `"case"."khach_hang_code" ILIKE $${queryParams.length + 1}`,
            );
            queryParams.push(`%${val.trim()}%`);
          } else if (col === 'customerName') {
            whereConditions.push(
              `"case"."khach_hang_name" ILIKE $${queryParams.length + 1}`,
            );
            queryParams.push(`%${val.trim()}%`);
          } else if (col === 'branchName' || col === 'branchExternalId') {
            whereConditions.push(
              `"case"."branch_external_id" ILIKE $${queryParams.length + 1}`,
            );
            queryParams.push(`%${val.trim()}%`);
          } else if (col === 'caseCount') {
            const num = parseInt(val.trim(), 10);
            if (!isNaN(num)) {
              havingConditions.push(
                `COUNT("case"."id")::int = $${queryParams.length + 1}`,
              );
              queryParams.push(num);
            }
          } else if (col === 'totalAmount') {
            const cleaned = val.replace(/[^0-9]/g, '');
            const num = parseInt(cleaned, 10);
            if (!isNaN(num) && num > 0) {
              havingConditions.push(
                `COALESCE(SUM("case"."tien_co_thue"), 0)::numeric >= $${queryParams.length + 1}`,
              );
              queryParams.push(num);
            }
          }
        }
      } catch {
        // ignore
      }
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    const havingClause =
      havingConditions.length > 0
        ? `HAVING ${havingConditions.join(' AND ')}`
        : '';

    let summarySql = `
      SELECT
        COUNT(DISTINCT COALESCE("case"."khach_hang_code", 'UNKNOWN'))::int AS total_customers,
        COALESCE(SUM("case"."tien_co_thue"), 0)::numeric AS total_revenue,
        COALESCE(SUM("case"."tien_da_thanh_toan"), 0)::numeric AS total_paid,
        COALESCE(SUM("case"."tien_con_phai_thanh_toan"), 0)::numeric AS total_balance,
        COALESCE(SUM(CASE WHEN COALESCE("case"."tien_con_phai_thanh_toan", 0) > 0 AND (CURRENT_DATE - DATE(COALESCE("case"."ngay_phat_sinh", now()))) <= 30 THEN "case"."tien_con_phai_thanh_toan" ELSE 0 END), 0)::numeric AS total_aging_0_30,
        COALESCE(SUM(CASE WHEN COALESCE("case"."tien_con_phai_thanh_toan", 0) > 0 AND (CURRENT_DATE - DATE(COALESCE("case"."ngay_phat_sinh", now()))) BETWEEN 31 AND 60 THEN "case"."tien_con_phai_thanh_toan" ELSE 0 END), 0)::numeric AS total_aging_31_60,
        COALESCE(SUM(CASE WHEN COALESCE("case"."tien_con_phai_thanh_toan", 0) > 0 AND (CURRENT_DATE - DATE(COALESCE("case"."ngay_phat_sinh", now()))) BETWEEN 61 AND 90 THEN "case"."tien_con_phai_thanh_toan" ELSE 0 END), 0)::numeric AS total_aging_61_90,
        COALESCE(SUM(CASE WHEN COALESCE("case"."tien_con_phai_thanh_toan", 0) > 0 AND (CURRENT_DATE - DATE(COALESCE("case"."ngay_phat_sinh", now()))) > 90 THEN "case"."tien_con_phai_thanh_toan" ELSE 0 END), 0)::numeric AS total_aging_over_90
      FROM "kgara_cases" "case"
      ${whereClause}
    `;

    if (havingConditions.length > 0) {
      summarySql = `
        SELECT
          COUNT(*)::int AS total_customers,
          COALESCE(SUM(tong_doanh_thu), 0)::numeric AS total_revenue,
          COALESCE(SUM(da_thanh_toan), 0)::numeric AS total_paid,
          COALESCE(SUM(con_phai_thu), 0)::numeric AS total_balance,
          COALESCE(SUM(aging_0_30), 0)::numeric AS total_aging_0_30,
          COALESCE(SUM(aging_31_60), 0)::numeric AS total_aging_31_60,
          COALESCE(SUM(aging_61_90), 0)::numeric AS total_aging_61_90,
          COALESCE(SUM(aging_over_90), 0)::numeric AS total_aging_over_90
        FROM (
          SELECT
            COALESCE("case"."khach_hang_code", 'UNKNOWN') AS khach_hang_code,
            COALESCE(SUM("case"."tien_co_thue"), 0)::numeric AS tong_doanh_thu,
            COALESCE(SUM("case"."tien_da_thanh_toan"), 0)::numeric AS da_thanh_toan,
            COALESCE(SUM("case"."tien_con_phai_thanh_toan"), 0)::numeric AS con_phai_thu,
            COALESCE(SUM(CASE WHEN COALESCE("case"."tien_con_phai_thanh_toan", 0) > 0 AND (CURRENT_DATE - DATE(COALESCE("case"."ngay_phat_sinh", now()))) <= 30 THEN "case"."tien_con_phai_thanh_toan" ELSE 0 END), 0)::numeric AS aging_0_30,
            COALESCE(SUM(CASE WHEN COALESCE("case"."tien_con_phai_thanh_toan", 0) > 0 AND (CURRENT_DATE - DATE(COALESCE("case"."ngay_phat_sinh", now()))) BETWEEN 31 AND 60 THEN "case"."tien_con_phai_thanh_toan" ELSE 0 END), 0)::numeric AS aging_31_60,
            COALESCE(SUM(CASE WHEN COALESCE("case"."tien_con_phai_thanh_toan", 0) > 0 AND (CURRENT_DATE - DATE(COALESCE("case"."ngay_phat_sinh", now()))) BETWEEN 61 AND 90 THEN "case"."tien_con_phai_thanh_toan" ELSE 0 END), 0)::numeric AS aging_61_90,
            COALESCE(SUM(CASE WHEN COALESCE("case"."tien_con_phai_thanh_toan", 0) > 0 AND (CURRENT_DATE - DATE(COALESCE("case"."ngay_phat_sinh", now()))) > 90 THEN "case"."tien_con_phai_thanh_toan" ELSE 0 END), 0)::numeric AS aging_over_90
          FROM "kgara_cases" "case"
          ${whereClause}
          GROUP BY COALESCE("case"."khach_hang_code", 'UNKNOWN')
          ${havingClause}
        ) sub
      `;
    }

    const summaryResult = await this.caseRepo.manager.query(
      summarySql,
      queryParams,
    );
    const total = parseInt(summaryResult[0]?.total_customers || '0', 10);

    let orderClause = 'ORDER BY con_phai_thu DESC, ngay_gan_nhat DESC';
    if (sorts) {
      const sortList = Array.isArray(sorts) ? sorts : [sorts];
      const sortParts: string[] = [];
      for (const s of sortList) {
        const isDesc = s.startsWith('-');
        const col = isDesc ? s.substring(1) : s;
        const dir = isDesc ? 'DESC' : 'ASC';
        if (col === 'customerCode') sortParts.push(`khach_hang_code ${dir}`);
        else if (col === 'customerName')
          sortParts.push(`khach_hang_name ${dir}`);
        else if (col === 'branchName' || col === 'branchExternalId')
          sortParts.push(`branch_external_id ${dir}`);
        else if (col === 'totalAmount' || col === 'totalRevenue')
          sortParts.push(`tong_doanh_thu ${dir}`);
        else if (col === 'paidAmount') sortParts.push(`da_thanh_toan ${dir}`);
        else if (col === 'balanceAmount' || col === 'balance')
          sortParts.push(`con_phai_thu ${dir}`);
        else if (col === 'caseCount' || col === 'soPhieu')
          sortParts.push(`so_phieu ${dir}`);
        else if (col === 'maxAgingDays' || col === 'aging')
          sortParts.push(`max_aging_days ${dir}`);
        else if (col === 'latestDate' || col === 'ngayPhatSinh')
          sortParts.push(`ngay_gan_nhat ${dir}`);
      }
      if (sortParts.length > 0) {
        orderClause = `ORDER BY ${sortParts.join(', ')}`;
      }
    }

    const dataParams = [
      ...queryParams,
      safePageSize,
      (safePage - 1) * safePageSize,
    ];
    const limitIdx = dataParams.length - 1;
    const offsetIdx = dataParams.length;

    const dataSql = `
      SELECT
        COALESCE("case"."khach_hang_code", 'UNKNOWN') AS khach_hang_code,
        MAX(COALESCE("case"."khach_hang_name", 'Chưa xác định')) AS khach_hang_name,
        MAX("case"."branch_external_id") AS branch_external_id,
        COUNT("case"."id")::int AS so_phieu,
        COALESCE(SUM("case"."tien_co_thue"), 0)::numeric AS tong_doanh_thu,
        COALESCE(SUM("case"."tien_da_thanh_toan"), 0)::numeric AS da_thanh_toan,
        COALESCE(SUM("case"."tien_con_phai_thanh_toan"), 0)::numeric AS con_phai_thu,
        MAX("case"."ngay_phat_sinh") AS ngay_gan_nhat,
        MIN("case"."ngay_phat_sinh") AS ngay_xa_nhat,
        COALESCE(MAX(CASE WHEN COALESCE("case"."tien_con_phai_thanh_toan", 0) > 0 THEN CURRENT_DATE - DATE(COALESCE("case"."ngay_phat_sinh", now())) ELSE 0 END), 0)::int AS max_aging_days,
        COALESCE(SUM(CASE WHEN COALESCE("case"."tien_con_phai_thanh_toan", 0) > 0 AND (CURRENT_DATE - DATE(COALESCE("case"."ngay_phat_sinh", now()))) <= 30 THEN "case"."tien_con_phai_thanh_toan" ELSE 0 END), 0)::numeric AS aging_0_30,
        COALESCE(SUM(CASE WHEN COALESCE("case"."tien_con_phai_thanh_toan", 0) > 0 AND (CURRENT_DATE - DATE(COALESCE("case"."ngay_phat_sinh", now()))) BETWEEN 31 AND 60 THEN "case"."tien_con_phai_thanh_toan" ELSE 0 END), 0)::numeric AS aging_31_60,
        COALESCE(SUM(CASE WHEN COALESCE("case"."tien_con_phai_thanh_toan", 0) > 0 AND (CURRENT_DATE - DATE(COALESCE("case"."ngay_phat_sinh", now()))) BETWEEN 61 AND 90 THEN "case"."tien_con_phai_thanh_toan" ELSE 0 END), 0)::numeric AS aging_61_90,
        COALESCE(SUM(CASE WHEN COALESCE("case"."tien_con_phai_thanh_toan", 0) > 0 AND (CURRENT_DATE - DATE(COALESCE("case"."ngay_phat_sinh", now()))) > 90 THEN "case"."tien_con_phai_thanh_toan" ELSE 0 END), 0)::numeric AS aging_over_90
      FROM "kgara_cases" "case"
      ${whereClause}
      GROUP BY COALESCE("case"."khach_hang_code", 'UNKNOWN')
      ${havingClause}
      ${orderClause}
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    const rawRows = await this.caseRepo.manager.query(dataSql, dataParams);

    const formattedData = rawRows.map((r: any) => ({
      customerCode: r.khach_hang_code,
      customerName: r.khach_hang_name,
      branchExternalId: r.branch_external_id,
      caseCount: Number(r.so_phieu) || 0,
      totalAmount: Number(r.tong_doanh_thu) || 0,
      paidAmount: Number(r.da_thanh_toan) || 0,
      balanceAmount: Number(r.con_phai_thu) || 0,
      latestDate: r.ngay_gan_nhat,
      oldestDate: r.ngay_xa_nhat,
      maxAgingDays: Number(r.max_aging_days) || 0,
      aging0_30: Number(r.aging_0_30) || 0,
      aging31_60: Number(r.aging_31_60) || 0,
      aging61_90: Number(r.aging_61_90) || 0,
      agingOver90: Number(r.aging_over_90) || 0,
    }));

    return {
      data: formattedData,
      total,
      page: safePage,
      pageSize: safePageSize,
      totalPages: Math.ceil(total / safePageSize),
      summary: {
        totalRevenue: Number(summaryResult[0]?.total_revenue) || 0,
        totalPaid: Number(summaryResult[0]?.total_paid) || 0,
        totalBalance: Number(summaryResult[0]?.total_balance) || 0,
        totalAging0_30: Number(summaryResult[0]?.total_aging_0_30) || 0,
        totalAging31_60: Number(summaryResult[0]?.total_aging_31_60) || 0,
        totalAging61_90: Number(summaryResult[0]?.total_aging_61_90) || 0,
        totalAgingOver90: Number(summaryResult[0]?.total_aging_over_90) || 0,
      },
    };
  }

  @Get('cases/customers-debt/column-options')
  @RequirePermissions({ resource: ErpResource.GARAGE, action: ErpAction.READ })
  async getCustomersDebtColumnOptions(
    @BranchId() branchId: string,
    @Query('column') column: string,
    @Query('search') search: string = '',
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '20',
    @Query('filtersStr') filtersStr?: string,
  ) {
    if (column === 'paymentProgress') {
      const options = ['PAID', 'PARTIAL', 'UNPAID'];
      const filtered = search
        ? options.filter((opt) =>
            opt.toLowerCase().includes(search.toLowerCase()),
          )
        : options;
      return {
        items: filtered,
        total: filtered.length,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      };
    }
    if (column === 'maxAgingDays') {
      const options = ['0-30', '31-60', '61-90', '>90'];
      const filtered = search
        ? options.filter((opt) =>
            opt.toLowerCase().includes(search.toLowerCase()),
          )
        : options;
      return {
        items: filtered,
        total: filtered.length,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      };
    }
    if (column === 'caseCount') {
      const branchCond = branchId
        ? `AND "branch_external_id" = '${branchId.replace(/'/g, "''")}'`
        : '';
      const rawCounts = await this.caseRepo.manager.query(`
        SELECT so_phieu::text AS value FROM (
          SELECT COUNT("id") AS so_phieu
          FROM "kgara_cases"
          WHERE "kgara_deleted_at" IS NULL
            AND ("tinh_trang_dich_vu" = 3 OR "ten_tinh_trang_dich_vu" = 'Kết thúc' OR "ten_tinh_trang_dich_vu" ILIKE '%kết thúc%' OR "ten_tinh_trang_dich_vu" ILIKE '%hoàn tất%')
            AND "ngay_phat_sinh" >= '2026-07-01'
            ${branchCond}
          GROUP BY COALESCE("khach_hang_code", 'UNKNOWN')
        ) sub
        GROUP BY so_phieu
        ORDER BY so_phieu ASC
      `);
      const items = rawCounts.map((r: any) => String(r.value));
      const filtered = search
        ? items.filter((it: string) => it.includes(search))
        : items;
      return {
        items: filtered,
        total: filtered.length,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      };
    }
    if (column === 'totalAmount') {
      const options = [
        { label: '< 10.000.000 đ', value: '0-10m' },
        { label: '10.000.000 - 20.000.000 đ', value: '10m-20m' },
        { label: '20.000.000 - 50.000.000 đ', value: '20m-50m' },
        { label: '> 50.000.000 đ', value: '>50m' },
      ];
      const filtered = search
        ? options.filter((opt) =>
            opt.label.toLowerCase().includes(search.toLowerCase()),
          )
        : options;
      return {
        items: filtered.map((f) => f.value),
        total: filtered.length,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      };
    }

    let selectExpr = '"case"."khach_hang_code"';
    if (column === 'customerName') selectExpr = '"case"."khach_hang_name"';
    else if (column === 'customerCode') selectExpr = '"case"."khach_hang_code"';
    else if (column === 'branchName' || column === 'branchExternalId')
      selectExpr = '"case"."branch_external_id"';

    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const safePageSize = Math.max(parseInt(pageSize, 10) || 20, 1);

    const query = this.caseRepo
      .createQueryBuilder('case')
      .select(`DISTINCT ${selectExpr}`, 'value');

    if (branchId) {
      query.andWhere('case.branchExternalId = :branchId', { branchId });
    }
    query.andWhere('case.kgaraDeletedAt IS NULL');
    query.andWhere(
      '(case.tinhTrangDichVu = 3 OR case.tenTinhTrangDichVu = :stFinished OR case.tenTinhTrangDichVu ILIKE :stFinPattern OR case.tenTinhTrangDichVu ILIKE :stDonePattern)',
      {
        stFinished: 'Kết thúc',
        stFinPattern: '%kết thúc%',
        stDonePattern: '%hoàn tất%',
      },
    );
    query.andWhere('case.ngayPhatSinh >= :baselineDate', {
      baselineDate: '2026-07-01',
    });
    query.andWhere(`${selectExpr} IS NOT NULL`);
    query.andWhere(`CAST(${selectExpr} AS TEXT) != ''`);

    if (filtersStr) {
      try {
        const filters = JSON.parse(filtersStr) as Record<string, string[]>;
        for (const [col, values] of Object.entries(filters)) {
          if (col === column) continue;
          if (!values || values.length === 0) continue;

          if (values[0] === '__ALL_MATCHING__') {
            const searchVal = (values[1] || '').trim();
            if (!searchVal) continue;
            if (col === 'customerCode') {
              query.andWhere('case.khachHangCode ILIKE :ccSearch', {
                ccSearch: `%${searchVal}%`,
              });
            } else if (col === 'customerName') {
              query.andWhere('case.khachHangName ILIKE :cnSearch', {
                cnSearch: `%${searchVal}%`,
              });
            } else if (col === 'branchName' || col === 'branchExternalId') {
              query.andWhere('case.branchExternalId ILIKE :brSearch', {
                brSearch: `%${searchVal}%`,
              });
            }
            continue;
          }

          const hasBlank = values.includes('__BLANK__');
          const realVals = values.filter((v) => v !== '__BLANK__');

          if (col === 'customerCode') {
            if (hasBlank && realVals.length > 0) {
              query.andWhere(
                "(case.khachHangCode IS NULL OR case.khachHangCode = '' OR case.khachHangCode IN (:...ccVals))",
                { ccVals: realVals },
              );
            } else if (hasBlank) {
              query.andWhere(
                "(case.khachHangCode IS NULL OR case.khachHangCode = '')",
              );
            } else {
              query.andWhere('case.khachHangCode IN (:...ccVals)', {
                ccVals: realVals,
              });
            }
          } else if (col === 'customerName') {
            if (hasBlank && realVals.length > 0) {
              query.andWhere(
                "(case.khachHangName IS NULL OR case.khachHangName = '' OR case.khachHangName IN (:...cnVals))",
                { cnVals: realVals },
              );
            } else if (hasBlank) {
              query.andWhere(
                "(case.khachHangName IS NULL OR case.khachHangName = '')",
              );
            } else {
              query.andWhere('case.khachHangName IN (:...cnVals)', {
                cnVals: realVals,
              });
            }
          } else if (col === 'branchName' || col === 'branchExternalId') {
            if (hasBlank && realVals.length > 0) {
              query.andWhere(
                "(case.branchExternalId IS NULL OR case.branchExternalId = '' OR case.branchExternalId IN (:...brVals))",
                { brVals: realVals },
              );
            } else if (hasBlank) {
              query.andWhere(
                "(case.branchExternalId IS NULL OR case.branchExternalId = '')",
              );
            } else {
              query.andWhere('case.branchExternalId IN (:...brVals)', {
                brVals: realVals,
              });
            }
          }
        }
      } catch {
        // ignore
      }
    }

    if (search) {
      query.andWhere(`CAST(${selectExpr} AS TEXT) ILIKE :search`, {
        search: `%${search}%`,
      });
    }

    query.orderBy('value', 'ASC');

    const totalRaw = await query
      .clone()
      .orderBy()
      .select(`COUNT(DISTINCT ${selectExpr})`, 'cnt')
      .getRawOne();
    const total = parseInt(totalRaw?.cnt || '0', 10);

    const raw = await query
      .offset((safePage - 1) * safePageSize)
      .limit(safePageSize)
      .getRawMany();

    return {
      items: raw.map((r) => String(r.value)).filter(Boolean),
      total,
      page: safePage,
      totalPages: Math.ceil(total / safePageSize),
    };
  }

  @Get('cases/by-customer/:customerCode')
  @RequirePermissions({ resource: ErpResource.GARAGE, action: ErpAction.READ })
  async getCasesByCustomer(
    @BranchId() branchId: string,
    @Param('customerCode') customerCode: string,
  ) {
    const query = this.caseRepo
      .createQueryBuilder('case')
      .where('case.kgaraDeletedAt IS NULL')
      .andWhere(
        '(case.tinhTrangDichVu = 3 OR case.tenTinhTrangDichVu = :stFinished OR case.tenTinhTrangDichVu ILIKE :stFinPattern OR case.tenTinhTrangDichVu ILIKE :stDonePattern)',
        {
          stFinished: 'Kết thúc',
          stFinPattern: '%kết thúc%',
          stDonePattern: '%hoàn tất%',
        },
      )
      .andWhere('case.ngayPhatSinh >= :baselineDate', {
        baselineDate: '2026-07-01',
      });

    if (customerCode === 'UNKNOWN' || customerCode === 'NO_CODE') {
      query.andWhere('case.khachHangCode IS NULL');
    } else {
      query.andWhere('case.khachHangCode = :customerCode', { customerCode });
    }

    if (branchId) {
      query.andWhere('case.branchExternalId = :branchId', { branchId });
    }

    query.orderBy('case.ngayPhatSinh', 'DESC');

    const cases = await query.getMany();

    const caseIds = cases.map((item) => item.id).filter(Boolean);
    const settlementsMap: Record<
      string,
      { receipts: number; payments: number }
    > = {};

    if (caseIds.length > 0) {
      const settlementRows = await this.settlementRepo
        .createQueryBuilder('s')
        .select('s.caseId', 'caseId')
        .addSelect('s.settlementType', 'settlementType')
        .addSelect('SUM(s.amount)', 'totalAmount')
        .where('s.caseId IN (:...caseIds)', { caseIds })
        .groupBy('s.caseId')
        .addGroupBy('s.settlementType')
        .getRawMany();

      for (const row of settlementRows) {
        if (!settlementsMap[row.caseId]) {
          settlementsMap[row.caseId] = { receipts: 0, payments: 0 };
        }
        if (row.settlementType === 'RECEIPT') {
          settlementsMap[row.caseId].receipts += Number(row.totalAmount || 0);
        } else if (row.settlementType === 'PAYMENT') {
          settlementsMap[row.caseId].payments += Number(row.totalAmount || 0);
        }
      }
    }

    const enriched = cases.map((c) => {
      const pDate = c.ngayPhatSinh ? new Date(c.ngayPhatSinh) : null;
      const today = new Date();
      let agingDays = 0;
      if (pDate) {
        const diffTime = Math.abs(today.getTime() - pDate.getTime());
        agingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }
      const setInfo = settlementsMap[c.id];
      const hasSettlement = setInfo !== undefined;
      const targetRev = extractNetPayableAmount(c);
      const totalPaid = hasSettlement
        ? setInfo.receipts
        : Number(c.tienDaThanhToan) || 0;
      const remainingBal = Math.max(0, targetRev - totalPaid);

      return {
        ...c,
        agingDays,
        tienCoThue: targetRev,
        tienDaThanhToan: totalPaid,
        tienConPhaiThanhToan: remainingBal,
      };
    });

    return enriched;
  }
}
