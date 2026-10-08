import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KgaraCase } from '../entities/kgara_case.entity';
import { KgaraGrossProfit } from '../entities/kgara_gross_profit.entity';

export interface GetSuppliersDebtParams {
  branchId?: string;
  page?: string | number;
  pageSize?: string | number;
  q?: string;
  from?: string;
  to?: string;
  sorts?: string | string[];
  filtersStr?: string;
  column_filters?: string;
  column_search?: string;
}

export interface SupplierDebtSummary {
  totalCustomers: number;
  totalCases: number;
  totalCost: number;
  totalPaid: number;
  totalBalance: number;
  totalAging0_30: number;
  totalAging31_60: number;
  totalAging61_90: number;
  totalAgingOver90: number;
  // Hỗ trợ backward compatibility với interface cũ
  totalPsNo: number;
  totalPsCo: number;
  totalCkCo: number;
  totalCkNo: number;
}

export interface FormattedSupplierDebtItem {
  id: string;
  customerCode: string;
  customerName: string;
  branchExternalId: string;
  caseCount: number;
  vehicleCount: number;
  costAmount: number;
  paidAmount: number;
  balanceAmount: number;
  latestDate: string | null;
  oldestDate: string | null;
  maxAgingDays: number;
  aging0_30: number;
  aging31_60: number;
  aging61_90: number;
  agingOver90: number;
  // Trường tương thích backward
  caseId: string;
  soPhieu: string;
  caseCode: string;
  bienSoXe: string;
  licensePlate: string;
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  statusName: string;
  revenueAmount: number;
  completedDate: string | null;
  agingDays: number;
  psNo: number;
  psCo: number;
  ckNo: number;
  ckCo: number;
}

@Injectable()
export class KgaraSuppliersService {
  constructor(
    @InjectRepository(KgaraCase)
    private readonly caseRepo: Repository<KgaraCase>,
    @InjectRepository(KgaraGrossProfit)
    private readonly grossProfitRepo: Repository<KgaraGrossProfit>,
  ) {}

  private mapColumnToDbField(col: string): string | null {
    if (
      col === 'customerName' ||
      col === 'khachHangName' ||
      col === 'supplierName' ||
      col === 'tenDoiTac'
    ) {
      return 'COALESCE("c"."khach_hang_name", "gp"."ten_khach_hang")';
    }
    if (
      col === 'customerCode' ||
      col === 'khachHangCode' ||
      col === 'supplierCode' ||
      col === 'maSoDoiTac'
    ) {
      return 'COALESCE("c"."khach_hang_code", "gp"."raw_data"->>\'MaKhachHang\', "gp"."ten_khach_hang")';
    }
    if (col === 'soPhieu' || col === 'caseCode') {
      return 'COALESCE("c"."so_chung_tu", "gp"."vu_viec_code")';
    }
    if (col === 'bienSoXe' || col === 'licensePlate') {
      return 'COALESCE("c"."bien_so_xe", substring("gp"."vu_viec_name" from \'Biển số: ([^ ]+)\'))';
    }
    return null;
  }

  async getSuppliersDebt(params: GetSuppliersDebtParams) {
    const safePage = Math.max(parseInt(String(params.page || '1'), 10) || 1, 1);
    const safePageSize = Math.max(
      parseInt(String(params.pageSize || '20'), 10) || 20,
      1,
    );

    const baselineDate = '2026-07-01';
    const effectiveFrom =
      params.from && params.from > baselineDate ? params.from : baselineDate;

    const dateExpr =
      'COALESCE("c"."ngay_hoan_thanh_cong_viec", ("gp"."raw_data"->>\'NgayKetThuc\')::timestamp, "c"."ngay_phat_sinh")';
    const costExpr = 'COALESCE("gp"."chi_phi", "c"."chi_phi", 0)::numeric';
    const customerCodeExpr =
      'COALESCE("c"."khach_hang_code", "gp"."raw_data"->>\'MaKhachHang\', "gp"."ten_khach_hang", \'UNKNOWN\')';

    const whereConditions: string[] = [
      '("c"."id" IS NULL OR "c"."kgara_deleted_at" IS NULL)',
      '("c"."id" IS NULL OR "c"."exclude_from_reports" IS NOT TRUE)',
      '("c"."id" IS NULL OR "c"."exclude_from_debt" IS NOT TRUE)',
      `${costExpr} > 0`,
      `${dateExpr} >= $1`,
    ];
    const queryParams: any[] = [effectiveFrom];

    if (params.branchId) {
      whereConditions.push(
        `(COALESCE("c"."branch_external_id", "gp"."branch_external_id") = $${queryParams.length + 1})`,
      );
      queryParams.push(params.branchId);
    }

    if (params.to) {
      const effTo =
        params.to.length === 10 ? `${params.to} 23:59:59.999` : params.to;
      whereConditions.push(`${dateExpr} <= $${queryParams.length + 1}`);
      queryParams.push(effTo);
    }

    if (params.q) {
      const qIdx = queryParams.length + 1;
      whereConditions.push(
        `("c"."so_chung_tu" ILIKE $${qIdx} OR "c"."bien_so_xe" ILIKE $${qIdx} OR "c"."khach_hang_name" ILIKE $${qIdx} OR "gp"."vu_viec_code" ILIKE $${qIdx} OR "gp"."ten_khach_hang" ILIKE $${qIdx} OR "c"."khach_hang_code" ILIKE $${qIdx})`,
      );
      queryParams.push(`%${params.q}%`);
    }

    const havingConditions: string[] = [];

    // Xử lý column_filters (hỗ trợ multi-value & blank search)
    const combinedFiltersStr = params.filtersStr || params.column_filters;
    if (combinedFiltersStr) {
      try {
        const filters = JSON.parse(combinedFiltersStr) as Record<
          string,
          string[]
        >;
        for (const [col, values] of Object.entries(filters)) {
          if (!values || values.length === 0) continue;

          if (col === 'caseCount') {
            const numVals = values
              .map((v) => parseInt(v, 10))
              .filter((v) => !isNaN(v));
            if (numVals.length > 0) {
              havingConditions.push(
                `COUNT(DISTINCT COALESCE("c"."so_chung_tu", "gp"."vu_viec_code"))::int = ANY($${queryParams.length + 1})`,
              );
              queryParams.push(numVals);
            }
            continue;
          }

          if (col === 'maxAgingDays') {
            const subConds: string[] = [];
            const maxAgingExpr = `COALESCE(MAX(CURRENT_DATE - DATE(${dateExpr})), 0)`;
            if (values.includes('0-30'))
              subConds.push(`(${maxAgingExpr} <= 30)`);
            if (values.includes('31-60'))
              subConds.push(`(${maxAgingExpr} BETWEEN 31 AND 60)`);
            if (values.includes('61-90'))
              subConds.push(`(${maxAgingExpr} BETWEEN 61 AND 90)`);
            if (values.includes('>90')) subConds.push(`(${maxAgingExpr} > 90)`);
            if (subConds.length > 0)
              havingConditions.push(`(${subConds.join(' OR ')})`);
            continue;
          }

          const dbCol = this.mapColumnToDbField(col);
          if (!dbCol) continue;

          // 1. All matching
          if (values[0] === '__ALL_MATCHING__') {
            const searchVal = (values[1] || '').trim();
            if (searchVal) {
              whereConditions.push(`${dbCol} ILIKE $${queryParams.length + 1}`);
              queryParams.push(`%${searchVal}%`);
            }
            continue;
          }

          // 2. Exact match
          if (values[0] === '__EXACT__') {
            const exactVal = (values[1] || '').trim();
            if (exactVal) {
              whereConditions.push(`${dbCol} = $${queryParams.length + 1}`);
              queryParams.push(exactVal);
            }
            continue;
          }

          // 3. Blank & Real values
          const hasBlank = values.includes('__BLANK__');
          const realVals = values.filter((v) => v !== '__BLANK__');
          if (hasBlank && realVals.length > 0) {
            whereConditions.push(
              `(${dbCol} IS NULL OR ${dbCol} = '' OR ${dbCol} = ANY($${queryParams.length + 1}))`,
            );
            queryParams.push(realVals);
          } else if (hasBlank) {
            whereConditions.push(`(${dbCol} IS NULL OR ${dbCol} = '')`);
          } else if (
            realVals.length === 1 &&
            (realVals[0].includes(';') || realVals[0].includes(','))
          ) {
            const multiParts = realVals[0]
              .split(/[;,]/)
              .map((s) => s.trim())
              .filter(Boolean);
            if (multiParts.length > 0) {
              const multiConds = multiParts.map(
                (_, i) => `${dbCol} ILIKE $${queryParams.length + 1 + i}`,
              );
              whereConditions.push(`(${multiConds.join(' OR ')})`);
              queryParams.push(...multiParts.map((p) => `%${p}%`));
            }
          } else if (realVals.length > 0) {
            whereConditions.push(`${dbCol} = ANY($${queryParams.length + 1})`);
            queryParams.push(realVals);
          }
        }
      } catch {
        // Bỏ qua
      }
    }

    // Xử lý column_search (sub-keyword, exact, multi, blank)
    if (params.column_search) {
      try {
        const searchObj = JSON.parse(params.column_search) as Record<
          string,
          string
        >;
        for (const [col, rawVal] of Object.entries(searchObj)) {
          if (!rawVal || !rawVal.trim()) continue;
          const dbCol = this.mapColumnToDbField(col);
          if (!dbCol) continue;

          const val = rawVal.trim();
          if (val === '__BLANK__' || val === '(Trống)') {
            whereConditions.push(`(${dbCol} IS NULL OR ${dbCol} = '')`);
          } else if (
            val.startsWith('exact:') ||
            (val.startsWith('"') && val.endsWith('"') && val.length > 2)
          ) {
            const exactVal = val.startsWith('exact:')
              ? val.slice(6).trim()
              : val.slice(1, -1).trim();
            whereConditions.push(`${dbCol} = $${queryParams.length + 1}`);
            queryParams.push(exactVal);
          } else if (val.includes(',') || val.includes(';')) {
            const parts = val
              .split(/[;,]/)
              .map((p) => p.trim())
              .filter(Boolean);
            if (parts.length > 0) {
              const conds = parts.map(
                (_, i) => `${dbCol} ILIKE $${queryParams.length + 1 + i}`,
              );
              whereConditions.push(`(${conds.join(' OR ')})`);
              queryParams.push(...parts.map((p) => `%${p}%`));
            }
          } else {
            whereConditions.push(`${dbCol} ILIKE $${queryParams.length + 1}`);
            queryParams.push(`%${val}%`);
          }
        }
      } catch {
        // Bỏ qua
      }
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    const havingClause =
      havingConditions.length > 0
        ? `HAVING ${havingConditions.join(' AND ')}`
        : '';
    const agingDaysExpr = `(CURRENT_DATE - DATE(${dateExpr}))`;

    // 1. Query Tổng hợp (Summary)
    let summarySql = `
      SELECT
        COUNT(DISTINCT ${customerCodeExpr})::int AS total_customers,
        COUNT(DISTINCT COALESCE("c"."so_chung_tu", "gp"."vu_viec_code"))::int AS total_cases,
        COALESCE(SUM(${costExpr}), 0)::numeric AS total_cost,
        0::numeric AS total_paid,
        COALESCE(SUM(${costExpr}), 0)::numeric AS total_balance,
        COALESCE(SUM(CASE WHEN ${agingDaysExpr} <= 30 THEN ${costExpr} ELSE 0 END), 0)::numeric AS total_aging_0_30,
        COALESCE(SUM(CASE WHEN ${agingDaysExpr} BETWEEN 31 AND 60 THEN ${costExpr} ELSE 0 END), 0)::numeric AS total_aging_31_60,
        COALESCE(SUM(CASE WHEN ${agingDaysExpr} BETWEEN 61 AND 90 THEN ${costExpr} ELSE 0 END), 0)::numeric AS total_aging_61_90,
        COALESCE(SUM(CASE WHEN ${agingDaysExpr} > 90 THEN ${costExpr} ELSE 0 END), 0)::numeric AS total_aging_over_90
      FROM "kgara_cases" "c"
      FULL OUTER JOIN "kgara_gross_profit" "gp" ON "gp"."vu_viec_code" = "c"."so_chung_tu"
      ${whereClause}
    `;

    if (havingConditions.length > 0) {
      summarySql = `
        SELECT
          COUNT(*)::int AS total_customers,
          COALESCE(SUM(case_count), 0)::int AS total_cases,
          COALESCE(SUM(cost_amount), 0)::numeric AS total_cost,
          0::numeric AS total_paid,
          COALESCE(SUM(balance_amount), 0)::numeric AS total_balance,
          COALESCE(SUM(aging_0_30), 0)::numeric AS total_aging_0_30,
          COALESCE(SUM(aging_31_60), 0)::numeric AS total_aging_31_60,
          COALESCE(SUM(aging_61_90), 0)::numeric AS total_aging_61_90,
          COALESCE(SUM(aging_over_90), 0)::numeric AS total_aging_over_90
        FROM (
          SELECT
            ${customerCodeExpr} AS customer_code,
            COUNT(DISTINCT COALESCE("c"."so_chung_tu", "gp"."vu_viec_code"))::int AS case_count,
            COALESCE(SUM(${costExpr}), 0)::numeric AS cost_amount,
            COALESCE(SUM(${costExpr}), 0)::numeric AS balance_amount,
            COALESCE(SUM(CASE WHEN ${agingDaysExpr} <= 30 THEN ${costExpr} ELSE 0 END), 0)::numeric AS aging_0_30,
            COALESCE(SUM(CASE WHEN ${agingDaysExpr} BETWEEN 31 AND 60 THEN ${costExpr} ELSE 0 END), 0)::numeric AS aging_31_60,
            COALESCE(SUM(CASE WHEN ${agingDaysExpr} BETWEEN 61 AND 90 THEN ${costExpr} ELSE 0 END), 0)::numeric AS aging_61_90,
            COALESCE(SUM(CASE WHEN ${agingDaysExpr} > 90 THEN ${costExpr} ELSE 0 END), 0)::numeric AS aging_over_90
          FROM "kgara_cases" "c"
          FULL OUTER JOIN "kgara_gross_profit" "gp" ON "gp"."vu_viec_code" = "c"."so_chung_tu"
          ${whereClause}
          GROUP BY ${customerCodeExpr}
          ${havingClause}
        ) sub
      `;
    }

    const summaryResult = await this.caseRepo.manager.query(
      summarySql,
      queryParams,
    );
    const total = parseInt(
      summaryResult[0]?.total_customers || summaryResult[0]?.total_cases || '0',
      10,
    );

    // 2. Sorting
    let orderClause =
      'ORDER BY "balance_amount" DESC, "latest_date" DESC NULLS LAST';
    if (params.sorts) {
      const sortList = Array.isArray(params.sorts)
        ? params.sorts
        : [params.sorts];
      const sortParts: string[] = [];
      for (const s of sortList) {
        const isDesc = s.startsWith('-');
        const col = isDesc ? s.substring(1) : s;
        const dir = isDesc ? 'DESC' : 'ASC';
        if (col === 'customerCode' || col === 'supplierCode')
          sortParts.push(`"customer_code" ${dir}`);
        else if (col === 'customerName' || col === 'supplierName')
          sortParts.push(`"customer_name" ${dir}`);
        else if (col === 'caseCount' || col === 'soPhieu')
          sortParts.push(`"case_count" ${dir}`);
        else if (
          col === 'costAmount' ||
          col === 'totalCost' ||
          col === 'balanceAmount' ||
          col === 'balance'
        )
          sortParts.push(`"cost_amount" ${dir}`);
        else if (col === 'latestDate' || col === 'completedDate')
          sortParts.push(`"latest_date" ${dir}`);
        else if (col === 'maxAgingDays' || col === 'aging')
          sortParts.push(`"max_aging_days" ${dir}`);
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

    // 3. Query Danh Sách Khách Hàng (Group By Customer)
    const dataSql = `
      SELECT
        ${customerCodeExpr} AS "customer_code",
        MAX(COALESCE("c"."khach_hang_name", "gp"."ten_khach_hang", 'Chưa xác định')) AS "customer_name",
        MAX(COALESCE("c"."branch_external_id", "gp"."branch_external_id", '')) AS "branch_external_id",
        COUNT(DISTINCT COALESCE("c"."so_chung_tu", "gp"."vu_viec_code"))::int AS "case_count",
        COUNT(DISTINCT COALESCE("c"."bien_so_xe", substring("gp"."vu_viec_name" from 'Biển số: ([^ ]+)')))::int AS "vehicle_count",
        COALESCE(SUM(${costExpr}), 0)::numeric AS "cost_amount",
        0::numeric AS "paid_amount",
        COALESCE(SUM(${costExpr}), 0)::numeric AS "balance_amount",
        MAX(${dateExpr}) AS "latest_date",
        MIN(${dateExpr}) AS "oldest_date",
        COALESCE(MAX(${agingDaysExpr}), 0)::int AS "max_aging_days",
        COALESCE(SUM(CASE WHEN ${agingDaysExpr} <= 30 THEN ${costExpr} ELSE 0 END), 0)::numeric AS "aging_0_30",
        COALESCE(SUM(CASE WHEN ${agingDaysExpr} BETWEEN 31 AND 60 THEN ${costExpr} ELSE 0 END), 0)::numeric AS "aging_31_60",
        COALESCE(SUM(CASE WHEN ${agingDaysExpr} BETWEEN 61 AND 90 THEN ${costExpr} ELSE 0 END), 0)::numeric AS "aging_61_90",
        COALESCE(SUM(CASE WHEN ${agingDaysExpr} > 90 THEN ${costExpr} ELSE 0 END), 0)::numeric AS "aging_over_90"
      FROM "kgara_cases" "c"
      FULL OUTER JOIN "kgara_gross_profit" "gp" ON "gp"."vu_viec_code" = "c"."so_chung_tu"
      ${whereClause}
      GROUP BY ${customerCodeExpr}
      ${havingClause}
      ${orderClause}
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    const rawRows = await this.caseRepo.manager.query(dataSql, dataParams);

    const formattedData: FormattedSupplierDebtItem[] = rawRows.map((r: any) => {
      const cost = Number(r.cost_amount) || 0;
      const balance = Number(r.balance_amount) || cost;
      const maxAging = Number(r.max_aging_days) || 0;
      const code = r.customer_code || 'UNKNOWN';
      const name = r.customer_name || 'Chưa xác định';
      return {
        id: code,
        customerCode: code,
        customerName: name,
        branchExternalId: r.branch_external_id || '',
        caseCount: Number(r.case_count) || 0,
        vehicleCount: Number(r.vehicle_count) || 0,
        costAmount: cost,
        paidAmount: Number(r.paid_amount) || 0,
        balanceAmount: balance,
        latestDate: r.latest_date,
        oldestDate: r.oldest_date,
        maxAgingDays: maxAging,
        aging0_30: Number(r.aging_0_30) || 0,
        aging31_60: Number(r.aging_31_60) || 0,
        aging61_90: Number(r.aging_61_90) || 0,
        agingOver90: Number(r.aging_over_90) || 0,
        // Backward compatibility
        caseId: code,
        soPhieu: code,
        caseCode: code,
        bienSoXe: '',
        licensePlate: '',
        supplierId: code,
        supplierCode: code,
        supplierName: name,
        statusName: 'Kết thúc',
        revenueAmount: 0,
        completedDate: r.latest_date,
        agingDays: maxAging,
        psNo: 0,
        psCo: cost,
        ckNo: 0,
        ckCo: balance,
      };
    });

    const totalCost = Number(summaryResult[0]?.total_cost) || 0;
    const totalBalance = Number(summaryResult[0]?.total_balance) || 0;
    const totalCases = Number(summaryResult[0]?.total_cases) || 0;

    return {
      data: formattedData,
      total,
      page: safePage,
      pageSize: safePageSize,
      totalPages: Math.ceil(total / safePageSize),
      summary: {
        totalCustomers: total,
        totalCases,
        totalCost,
        totalPaid: 0,
        totalBalance,
        totalAging0_30: Number(summaryResult[0]?.total_aging_0_30) || 0,
        totalAging31_60: Number(summaryResult[0]?.total_aging_31_60) || 0,
        totalAging61_90: Number(summaryResult[0]?.total_aging_61_90) || 0,
        totalAgingOver90: Number(summaryResult[0]?.total_aging_over_90) || 0,
        // Backward compatibility
        totalPsNo: 0,
        totalPsCo: totalCost,
        totalCkCo: totalBalance,
        totalCkNo: 0,
      },
    };
  }

  async getSuppliersDebtColumnOptions(
    branchId: string,
    column: string,
    search: string = '',
    page: string | number = 1,
    pageSize: string | number = 20,
    filtersStr?: string,
  ) {
    const dbCol = this.mapColumnToDbField(column);
    if (!dbCol) {
      return { items: [], total: 0, page: 1, totalPages: 1 };
    }

    const safePage = Math.max(parseInt(String(page || '1'), 10) || 1, 1);
    const safePageSize = Math.max(
      parseInt(String(pageSize || '20'), 10) || 20,
      1,
    );

    const dateExpr =
      'COALESCE("c"."ngay_hoan_thanh_cong_viec", ("gp"."raw_data"->>\'NgayKetThuc\')::timestamp, "c"."ngay_phat_sinh")';
    const costExpr = 'COALESCE("gp"."chi_phi", "c"."chi_phi", 0)::numeric';

    const whereConditions: string[] = [
      '("c"."id" IS NULL OR "c"."kgara_deleted_at" IS NULL)',
      `${costExpr} > 0`,
      `${dateExpr} >= $1`,
      `${dbCol} IS NOT NULL`,
      `CAST(${dbCol} AS TEXT) != ''`,
    ];
    const queryParams: any[] = ['2026-07-01'];

    if (branchId) {
      whereConditions.push(
        `(COALESCE("c"."branch_external_id", "gp"."branch_external_id") = $${queryParams.length + 1})`,
      );
      queryParams.push(branchId);
    }

    if (search) {
      whereConditions.push(
        `CAST(${dbCol} AS TEXT) ILIKE $${queryParams.length + 1}`,
      );
      queryParams.push(`%${search}%`);
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    const countSql = `
      SELECT COUNT(DISTINCT ${dbCol})::int AS total
      FROM "kgara_cases" "c"
      FULL OUTER JOIN "kgara_gross_profit" "gp" ON "gp"."vu_viec_code" = "c"."so_chung_tu"
      ${whereClause}
    `;
    const countRes = await this.caseRepo.manager.query(countSql, queryParams);
    const total = parseInt(countRes[0]?.total || '0', 10);

    const dataParams = [
      ...queryParams,
      safePageSize,
      (safePage - 1) * safePageSize,
    ];
    const dataSql = `
      SELECT DISTINCT ${dbCol} AS value
      FROM "kgara_cases" "c"
      FULL OUTER JOIN "kgara_gross_profit" "gp" ON "gp"."vu_viec_code" = "c"."so_chung_tu"
      ${whereClause}
      ORDER BY value ASC
      LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}
    `;
    const rawRows = await this.caseRepo.manager.query(dataSql, dataParams);

    return {
      items: rawRows.map((r: any) => String(r.value)).filter(Boolean),
      total,
      page: safePage,
      totalPages: Math.ceil(total / safePageSize),
    };
  }

  async getCasesBySupplier(branchId: string, supplierId: string) {
    const cases = await this.caseRepo
      .createQueryBuilder('c')
      .where('(c.khachHangCode = :id OR c.id = :id OR c.soChungTu = :id)', {
        id: supplierId,
      })
      .andWhere('c.kgaraDeletedAt IS NULL')
      .getMany();

    return {
      payables: [],
      linkedCases: cases,
    };
  }
}
