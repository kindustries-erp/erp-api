import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { KgaraCase } from '../entities/kgara_case.entity';
import { GARAGE_AGING_BUCKET_RANGES } from '../helpers/garage-aging-bucket.helper';

/** Mốc bắt đầu theo dõi công nợ: từ 07/2026 (2026-07-01). */
export const GARAGE_DEBT_BASELINE_DATE = '2026-07-01';

export type CustomersDebtQueryParams = {
  page?: string;
  pageSize?: string;
  q?: string;
  from?: string;
  to?: string;
  sorts?: string | string[];
  filtersStr?: string;
  columnFiltersParam?: string;
  columnSearchParam?: string;
};

/**
 * Truy vấn công nợ khách hàng (gom theo biển số xe). Dùng chung cho danh sách
 * và xuất Excel (`unpaged: true` bỏ LIMIT/OFFSET để lấy toàn bộ tập lọc).
 */
@Injectable()
export class KgaraCustomersDebtQueryService {
  constructor(
    @InjectRepository(KgaraCase)
    private readonly caseRepo: Repository<KgaraCase>,
  ) {}

  async getCustomersDebt(
    branchId: string,
    params: CustomersDebtQueryParams,
    options: { unpaged?: boolean } = {},
  ) {
    const {
      page = '1',
      pageSize = '20',
      q = '',
      from,
      to,
      sorts,
      filtersStr,
      columnFiltersParam,
      columnSearchParam,
    } = params;
    const unpaged = options.unpaged === true;

    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const safePageSize = Math.max(parseInt(pageSize, 10) || 20, 1);

    const effectiveFrom =
      from && from > GARAGE_DEBT_BASELINE_DATE
        ? from
        : GARAGE_DEBT_BASELINE_DATE;

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
          } else if (col === 'agingBucket') {
            const subConds: string[] = [];
            for (const v of values) {
              const range = GARAGE_AGING_BUCKET_RANGES[v];
              if (!range) continue;
              subConds.push(
                `(COALESCE(SUM(CASE WHEN COALESCE("case"."tien_con_phai_thanh_toan", 0) > 0 AND (CURRENT_DATE - DATE("case"."ngay_hoan_thanh_cong_viec")) ${range} THEN "case"."tien_con_phai_thanh_toan" ELSE 0 END), 0) > 0)`,
              );
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
          } else if (col === 'balanceAmount' || col === 'balance') {
            const subConds: string[] = [];
            const balExpr =
              'COALESCE(SUM("case"."tien_con_phai_thanh_toan"), 0)';
            if (
              values.includes('0') ||
              values.includes('0 đ') ||
              values.includes('zero')
            ) {
              subConds.push(`(${balExpr} <= 0)`);
            }
            if (values.includes('0-10m') || values.includes('<10m')) {
              subConds.push(`(${balExpr} > 0 AND ${balExpr} < 10000000)`);
            }
            if (values.includes('10m-20m')) {
              subConds.push(`(${balExpr} BETWEEN 10000000 AND 20000000)`);
            }
            if (values.includes('20m-50m')) {
              subConds.push(`(${balExpr} BETWEEN 20000000 AND 50000000)`);
            }
            if (values.includes('>50m')) {
              subConds.push(`(${balExpr} > 50000000)`);
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
          } else if (col === 'balanceAmount' || col === 'balance') {
            const cleaned = val.replace(/[^0-9]/g, '');
            const num = parseInt(cleaned, 10);
            if (!isNaN(num) && num > 0) {
              havingConditions.push(
                `COALESCE(SUM("case"."tien_con_phai_thanh_toan"), 0)::numeric >= $${queryParams.length + 1}`,
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

    const dataParams = unpaged
      ? [...queryParams]
      : [...queryParams, safePageSize, (safePage - 1) * safePageSize];
    const paginationClause = unpaged
      ? ''
      : `LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`;

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
      ${paginationClause}
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
}
