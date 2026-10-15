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
import { KgaraCustomerCasesDetailService } from '../services/kgara-customer-cases-detail.service';

@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('greenway')
export class KgaraCustomersController {
  constructor(
    @InjectRepository(KgaraCase)
    private readonly caseRepo: Repository<KgaraCase>,
    @InjectRepository(KgaraCaseSettlement)
    private readonly settlementRepo: Repository<KgaraCaseSettlement>,
    private readonly customerCasesDetailService: KgaraCustomerCasesDetailService,
  ) {}

  @Get('cases/customers-debt')
  @RequirePermissions({
    resource: ErpResource.GARAGE_DEBTS,
    action: ErpAction.READ,
  })
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
      '"case"."exclude_from_reports" IS NOT TRUE',
      '"case"."exclude_from_debt" IS NOT TRUE',
      '("case"."tinh_trang_dich_vu" = 3 OR "case"."ten_tinh_trang_dich_vu" = \'Kết thúc\' OR "case"."ten_tinh_trang_dich_vu" ILIKE \'%kết thúc%\' OR "case"."ten_tinh_trang_dich_vu" ILIKE \'%hoàn tất%\')',
      '"case"."ngay_hoan_thanh_cong_viec" IS NOT NULL',
    ];
    const queryParams: any[] = [];

    whereConditions.push(
      `"case"."ngay_hoan_thanh_cong_viec" >= $${queryParams.length + 1}`,
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
        `"case"."ngay_hoan_thanh_cong_viec" <= $${queryParams.length + 1}`,
      );
      queryParams.push(to.length === 10 ? `${to} 23:59:59.999` : to);
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
            } else if (col === 'customer') {
              whereConditions.push(
                `("case"."khach_hang_name" ILIKE $${queryParams.length + 1} OR "case"."khach_hang_code" ILIKE $${queryParams.length + 1})`,
              );
              queryParams.push(`%${searchVal}%`);
            } else if (col === 'licensePlate' || col === 'bienSoXe') {
              whereConditions.push(
                `"case"."bien_so_xe" ILIKE $${queryParams.length + 1}`,
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

          if (col === 'licensePlate' || col === 'bienSoXe') {
            if (hasBlank && realVals.length > 0) {
              whereConditions.push(
                `("case"."bien_so_xe" IS NULL OR "case"."bien_so_xe" = '' OR TRIM("case"."bien_so_xe") = '' OR "case"."bien_so_xe" = ANY($${queryParams.length + 1}))`,
              );
              queryParams.push(realVals);
            } else if (hasBlank) {
              whereConditions.push(
                `("case"."bien_so_xe" IS NULL OR "case"."bien_so_xe" = '' OR TRIM("case"."bien_so_xe") = '')`,
              );
            } else {
              whereConditions.push(
                `"case"."bien_so_xe" = ANY($${queryParams.length + 1})`,
              );
              queryParams.push(realVals);
            }
          } else if (col === 'customer') {
            if (hasBlank && realVals.length > 0) {
              whereConditions.push(
                `("case"."khach_hang_name" IS NULL OR "case"."khach_hang_name" = '' OR "case"."khach_hang_name" = ANY($${queryParams.length + 1}) OR "case"."khach_hang_code" = ANY($${queryParams.length + 1}))`,
              );
              queryParams.push(realVals);
            } else if (hasBlank) {
              whereConditions.push(
                `("case"."khach_hang_name" IS NULL OR "case"."khach_hang_name" = '')`,
              );
            } else {
              whereConditions.push(
                `("case"."khach_hang_name" = ANY($${queryParams.length + 1}) OR "case"."khach_hang_code" = ANY($${queryParams.length + 1}))`,
              );
              queryParams.push(realVals);
            }
          } else if (col === 'customerCode') {
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
              'COALESCE(MAX(CASE WHEN COALESCE("case"."tien_con_phai_thanh_toan", 0) > 0 THEN CURRENT_DATE - DATE("case"."ngay_hoan_thanh_cong_viec") ELSE 0 END), 0)';
            if (values.includes('0') || values.includes('0 ngày')) {
              subConds.push(`(${maxAgingExpr} = 0)`);
            }
            if (values.includes('1-30') || values.includes('1-30 ngày')) {
              subConds.push(`(${maxAgingExpr} BETWEEN 1 AND 30)`);
            }
            if (values.includes('0-30') || values.includes('0-30 ngày')) {
              subConds.push(`(${maxAgingExpr} <= 30)`);
            }
            if (values.includes('31-60') || values.includes('31-60 ngày')) {
              subConds.push(`(${maxAgingExpr} BETWEEN 31 AND 60)`);
            }
            if (values.includes('61-90') || values.includes('61-90 ngày')) {
              subConds.push(`(${maxAgingExpr} BETWEEN 61 AND 90)`);
            }
            if (values.includes('>90') || values.includes('>90 ngày')) {
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
          if (col === 'licensePlate' || col === 'bienSoXe') {
            whereConditions.push(
              `"case"."bien_so_xe" ILIKE $${queryParams.length + 1}`,
            );
            queryParams.push(`%${val.trim()}%`);
          } else if (col === 'customer') {
            whereConditions.push(
              `("case"."khach_hang_name" ILIKE $${queryParams.length + 1} OR "case"."khach_hang_code" ILIKE $${queryParams.length + 1})`,
            );
            queryParams.push(`%${val.trim()}%`);
          } else if (col === 'customerCode') {
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
        COUNT(DISTINCT COALESCE(NULLIF(TRIM("case"."bien_so_xe"), ''), 'CHUA_CO_BKS'))::int AS total_customers,
        COALESCE(SUM("case"."tien_co_thue"), 0)::numeric AS total_revenue,
        COALESCE(SUM("case"."tien_da_thanh_toan"), 0)::numeric AS total_paid,
        COALESCE(SUM("case"."tien_con_phai_thanh_toan"), 0)::numeric AS total_balance,
        COALESCE(SUM(CASE WHEN COALESCE("case"."tien_con_phai_thanh_toan", 0) > 0 AND (CURRENT_DATE - DATE("case"."ngay_hoan_thanh_cong_viec")) <= 30 THEN "case"."tien_con_phai_thanh_toan" ELSE 0 END), 0)::numeric AS total_aging_0_30,
        COALESCE(SUM(CASE WHEN COALESCE("case"."tien_con_phai_thanh_toan", 0) > 0 AND (CURRENT_DATE - DATE("case"."ngay_hoan_thanh_cong_viec")) BETWEEN 31 AND 60 THEN "case"."tien_con_phai_thanh_toan" ELSE 0 END), 0)::numeric AS total_aging_31_60,
        COALESCE(SUM(CASE WHEN COALESCE("case"."tien_con_phai_thanh_toan", 0) > 0 AND (CURRENT_DATE - DATE("case"."ngay_hoan_thanh_cong_viec")) BETWEEN 61 AND 90 THEN "case"."tien_con_phai_thanh_toan" ELSE 0 END), 0)::numeric AS total_aging_61_90,
        COALESCE(SUM(CASE WHEN COALESCE("case"."tien_con_phai_thanh_toan", 0) > 0 AND (CURRENT_DATE - DATE("case"."ngay_hoan_thanh_cong_viec")) > 90 THEN "case"."tien_con_phai_thanh_toan" ELSE 0 END), 0)::numeric AS total_aging_over_90
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
            COALESCE(NULLIF(TRIM("case"."bien_so_xe"), ''), 'CHUA_CO_BKS') AS bien_so_xe,
            COALESCE(SUM("case"."tien_co_thue"), 0)::numeric AS tong_doanh_thu,
            COALESCE(SUM("case"."tien_da_thanh_toan"), 0)::numeric AS da_thanh_toan,
            COALESCE(SUM("case"."tien_con_phai_thanh_toan"), 0)::numeric AS con_phai_thu,
            COALESCE(SUM(CASE WHEN COALESCE("case"."tien_con_phai_thanh_toan", 0) > 0 AND (CURRENT_DATE - DATE("case"."ngay_hoan_thanh_cong_viec")) <= 30 THEN "case"."tien_con_phai_thanh_toan" ELSE 0 END), 0)::numeric AS aging_0_30,
            COALESCE(SUM(CASE WHEN COALESCE("case"."tien_con_phai_thanh_toan", 0) > 0 AND (CURRENT_DATE - DATE("case"."ngay_hoan_thanh_cong_viec")) BETWEEN 31 AND 60 THEN "case"."tien_con_phai_thanh_toan" ELSE 0 END), 0)::numeric AS aging_31_60,
            COALESCE(SUM(CASE WHEN COALESCE("case"."tien_con_phai_thanh_toan", 0) > 0 AND (CURRENT_DATE - DATE("case"."ngay_hoan_thanh_cong_viec")) BETWEEN 61 AND 90 THEN "case"."tien_con_phai_thanh_toan" ELSE 0 END), 0)::numeric AS aging_61_90,
            COALESCE(SUM(CASE WHEN COALESCE("case"."tien_con_phai_thanh_toan", 0) > 0 AND (CURRENT_DATE - DATE("case"."ngay_hoan_thanh_cong_viec")) > 90 THEN "case"."tien_con_phai_thanh_toan" ELSE 0 END), 0)::numeric AS aging_over_90
          FROM "kgara_cases" "case"
          ${whereClause}
          GROUP BY COALESCE(NULLIF(TRIM("case"."bien_so_xe"), ''), 'CHUA_CO_BKS')
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
        if (col === 'licensePlate' || col === 'bienSoXe')
          sortParts.push(`bien_so_xe ${dir}`);
        else if (col === 'customer' || col === 'customerName')
          sortParts.push(`khach_hang_name ${dir}`);
        else if (col === 'customerCode')
          sortParts.push(`khach_hang_code ${dir}`);
        else if (col === 'branchName' || col === 'branchExternalId')
          sortParts.push(`branch_external_id ${dir}`);
        else if (col === 'totalAmount' || col === 'totalRevenue')
          sortParts.push(`tong_doanh_thu ${dir}`);
        else if (col === 'paidAmount') sortParts.push(`da_thanh_toan ${dir}`);
        else if (col === 'balanceAmount' || col === 'balance')
          sortParts.push(`con_phai_thu ${dir}`);
        else if (col === 'caseCount' || col === 'soPhieu')
          sortParts.push(`so_phieu ${dir}`);
        else if (col === 'aging0_30') sortParts.push(`aging_0_30 ${dir}`);
        else if (col === 'aging31_60') sortParts.push(`aging_31_60 ${dir}`);
        else if (col === 'aging61_90') sortParts.push(`aging_61_90 ${dir}`);
        else if (col === 'agingOver90') sortParts.push(`aging_over_90 ${dir}`);
        else if (col === 'maxAgingDays' || col === 'aging')
          sortParts.push(`max_aging_days ${dir}`);
        else if (
          col === 'latestDate' ||
          col === 'ngayHoanThanhCongViec' ||
          col === 'ngayPhatSinh'
        )
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
        COALESCE(NULLIF(TRIM("case"."bien_so_xe"), ''), 'CHUA_CO_BKS') AS bien_so_xe,
        MAX(COALESCE("case"."khach_hang_code", '')) AS khach_hang_code,
        MAX(COALESCE("case"."khach_hang_name", 'Chưa xác định')) AS khach_hang_name,
        MAX("case"."branch_external_id") AS branch_external_id,
        COUNT("case"."id")::int AS so_phieu,
        COALESCE(SUM("case"."tien_co_thue"), 0)::numeric AS tong_doanh_thu,
        COALESCE(SUM("case"."tien_da_thanh_toan"), 0)::numeric AS da_thanh_toan,
        COALESCE(SUM("case"."tien_con_phai_thanh_toan"), 0)::numeric AS con_phai_thu,
        MAX("case"."ngay_hoan_thanh_cong_viec") AS ngay_gan_nhat,
        MIN("case"."ngay_hoan_thanh_cong_viec") AS ngay_xa_nhat,
        COALESCE(MAX(CASE WHEN COALESCE("case"."tien_con_phai_thanh_toan", 0) > 0 THEN CURRENT_DATE - DATE("case"."ngay_hoan_thanh_cong_viec") ELSE 0 END), 0)::int AS max_aging_days,
        COALESCE(SUM(CASE WHEN COALESCE("case"."tien_con_phai_thanh_toan", 0) > 0 AND (CURRENT_DATE - DATE("case"."ngay_hoan_thanh_cong_viec")) <= 30 THEN "case"."tien_con_phai_thanh_toan" ELSE 0 END), 0)::numeric AS aging_0_30,
        COALESCE(SUM(CASE WHEN COALESCE("case"."tien_con_phai_thanh_toan", 0) > 0 AND (CURRENT_DATE - DATE("case"."ngay_hoan_thanh_cong_viec")) BETWEEN 31 AND 60 THEN "case"."tien_con_phai_thanh_toan" ELSE 0 END), 0)::numeric AS aging_31_60,
        COALESCE(SUM(CASE WHEN COALESCE("case"."tien_con_phai_thanh_toan", 0) > 0 AND (CURRENT_DATE - DATE("case"."ngay_hoan_thanh_cong_viec")) BETWEEN 61 AND 90 THEN "case"."tien_con_phai_thanh_toan" ELSE 0 END), 0)::numeric AS aging_61_90,
        COALESCE(SUM(CASE WHEN COALESCE("case"."tien_con_phai_thanh_toan", 0) > 0 AND (CURRENT_DATE - DATE("case"."ngay_hoan_thanh_cong_viec")) > 90 THEN "case"."tien_con_phai_thanh_toan" ELSE 0 END), 0)::numeric AS aging_over_90
      FROM "kgara_cases" "case"
      ${whereClause}
      GROUP BY COALESCE(NULLIF(TRIM("case"."bien_so_xe"), ''), 'CHUA_CO_BKS')
      ${havingClause}
      ${orderClause}
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    const rawRows = await this.caseRepo.manager.query(dataSql, dataParams);

    const formattedData = rawRows.map((r: any) => ({
      licensePlate: r.bien_so_xe === 'CHUA_CO_BKS' ? '' : r.bien_so_xe,
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
  @RequirePermissions({
    resource: ErpResource.GARAGE_DEBTS,
    action: ErpAction.READ,
  })
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
      const options = [
        '0 ngày',
        '1-30 ngày',
        '31-60 ngày',
        '61-90 ngày',
        '>90 ngày',
      ];
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
            AND "exclude_from_reports" IS NOT TRUE
            AND "exclude_from_debt" IS NOT TRUE
            AND ("tinh_trang_dich_vu" = 3 OR "ten_tinh_trang_dich_vu" = 'Kết thúc' OR "ten_tinh_trang_dich_vu" ILIKE '%kết thúc%' OR "ten_tinh_trang_dich_vu" ILIKE '%hoàn tất%')
            AND "ngay_hoan_thanh_cong_viec" IS NOT NULL
            AND "ngay_hoan_thanh_cong_viec" >= '2026-07-01'
            ${branchCond}
          GROUP BY COALESCE(NULLIF(TRIM("bien_so_xe"), ''), 'CHUA_CO_BKS')
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
    if (column === 'licensePlate' || column === 'bienSoXe')
      selectExpr = '"case"."bien_so_xe"';
    else if (column === 'customer' || column === 'customerName')
      selectExpr = '"case"."khach_hang_name"';
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
    query.andWhere('case.excludeFromReports IS NOT TRUE');
    query.andWhere('case.excludeFromDebt IS NOT TRUE');
    query.andWhere(
      '(case.tinhTrangDichVu = 3 OR case.tenTinhTrangDichVu = :stFinished OR case.tenTinhTrangDichVu ILIKE :stFinPattern OR case.tenTinhTrangDichVu ILIKE :stDonePattern)',
      {
        stFinished: 'Kết thúc',
        stFinPattern: '%kết thúc%',
        stDonePattern: '%hoàn tất%',
      },
    );
    query.andWhere('case.ngayHoanThanhCongViec IS NOT NULL');
    query.andWhere('case.ngayHoanThanhCongViec >= :baselineDate', {
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
            if (col === 'licensePlate' || col === 'bienSoXe') {
              query.andWhere('case.bienSoXe ILIKE :lpSearch', {
                lpSearch: `%${searchVal}%`,
              });
            } else if (col === 'customer') {
              query.andWhere(
                '(case.khachHangName ILIKE :cSearch OR case.khachHangCode ILIKE :cSearch)',
                { cSearch: `%${searchVal}%` },
              );
            } else if (col === 'customerCode') {
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

          if (col === 'licensePlate' || col === 'bienSoXe') {
            if (hasBlank && realVals.length > 0) {
              query.andWhere(
                "(case.bienSoXe IS NULL OR case.bienSoXe = '' OR TRIM(case.bienSoXe) = '' OR case.bienSoXe IN (:...lpVals))",
                { lpVals: realVals },
              );
            } else if (hasBlank) {
              query.andWhere(
                "(case.bienSoXe IS NULL OR case.bienSoXe = '' OR TRIM(case.bienSoXe) = '')",
              );
            } else {
              query.andWhere('case.bienSoXe IN (:...lpVals)', {
                lpVals: realVals,
              });
            }
          } else if (col === 'customer') {
            if (hasBlank && realVals.length > 0) {
              query.andWhere(
                "(case.khachHangName IS NULL OR case.khachHangName = '' OR case.khachHangName IN (:...custVals) OR case.khachHangCode IN (:...custVals))",
                { custVals: realVals },
              );
            } else if (hasBlank) {
              query.andWhere(
                "(case.khachHangName IS NULL OR case.khachHangName = '')",
              );
            } else {
              query.andWhere(
                '(case.khachHangName IN (:...custVals) OR case.khachHangCode IN (:...custVals))',
                { custVals: realVals },
              );
            }
          } else if (col === 'customerCode') {
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

    const isCustomerCol = column === 'customer' || column === 'customerName';

    if (search) {
      if (isCustomerCol) {
        query.andWhere(
          '(case.khachHangName ILIKE :cSearch OR case.khachHangCode ILIKE :cSearch)',
          { cSearch: `%${search}%` },
        );
      } else {
        query.andWhere(`CAST(${selectExpr} AS TEXT) ILIKE :search`, {
          search: `%${search}%`,
        });
      }
    }

    if (isCustomerCol) {
      const totalRaw = await query
        .clone()
        .orderBy()
        .select('COUNT(DISTINCT "case"."khach_hang_name")', 'cnt')
        .getRawOne();
      const total = parseInt(totalRaw?.cnt || '0', 10);

      const raw = await query
        .clone()
        .select('"case"."khach_hang_name"', 'value')
        .addSelect('MAX("case"."khach_hang_code")', 'extra')
        .groupBy('"case"."khach_hang_name"')
        .orderBy('value', 'ASC')
        .offset((safePage - 1) * safePageSize)
        .limit(safePageSize)
        .getRawMany();

      return {
        items: raw
          .map((r) => {
            const val = String(r.value || '').trim();
            const extra = String(r.extra || '').trim();
            return {
              label: extra && extra !== val ? `${val} (${extra})` : val,
              value: val,
            };
          })
          .filter((it) => it.value),
        total,
        page: safePage,
        totalPages: Math.ceil(total / safePageSize),
      };
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
  @RequirePermissions({
    resource: ErpResource.GARAGE_DEBTS,
    action: ErpAction.READ,
  })
  async getCasesByCustomer(
    @BranchId() branchId: string,
    @Param('customerCode') customerCode: string,
  ) {
    return this.customerCasesDetailService.getCasesByCustomer(
      branchId,
      customerCode,
    );
  }
}
