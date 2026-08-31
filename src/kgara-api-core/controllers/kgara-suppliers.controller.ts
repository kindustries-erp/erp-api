import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KgaraPayable } from '../entities/kgara_payable.entity';
import { KgaraCase } from '../entities/kgara_case.entity';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../../auth/guards/core-rbac.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { ErpResource, ErpAction } from '@/rbac-core/enums';
import { BranchId } from '../decorators/branch-id.decorator';

@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('greenway')
export class KgaraSuppliersController {
  constructor(
    @InjectRepository(KgaraPayable)
    private readonly payableRepo: Repository<KgaraPayable>,
    @InjectRepository(KgaraCase)
    private readonly caseRepo: Repository<KgaraCase>,
  ) {}

  @Get('payables/suppliers-debt')
  @RequirePermissions({ resource: ErpResource.GARAGE, action: ErpAction.READ })
  async getSuppliersDebt(
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

    // Mốc bắt đầu theo dõi: từ 07/2026 (2026-07-01)
    const baselineDate = '2026-07-01';
    const effectiveFrom = from && from > baselineDate ? from : baselineDate;

    const whereConditions: string[] = [
      `COALESCE("p"."period_to", "p"."period_from", "p"."created_at"::date) >= $1`,
    ];
    const queryParams: any[] = [effectiveFrom];

    if (branchId) {
      whereConditions.push(
        `"p"."branch_external_id" = $${queryParams.length + 1}`,
      );
      queryParams.push(branchId);
    }

    if (to) {
      whereConditions.push(
        `COALESCE("p"."period_from", "p"."period_to") <= $${queryParams.length + 1}`,
      );
      queryParams.push(to);
    }

    if (q) {
      const qIdx = queryParams.length + 1;
      whereConditions.push(
        `("p"."ma_so_doi_tac" ILIKE $${qIdx} OR "p"."ten_doi_tac" ILIKE $${qIdx} OR "p"."doi_tac_id" ILIKE $${qIdx} OR "p"."ma_so_vu_viec" ILIKE $${qIdx})`,
      );
      queryParams.push(`%${q}%`);
    }

    const combinedFiltersStr = filtersStr || columnFiltersParam;
    if (combinedFiltersStr) {
      try {
        const filters = JSON.parse(combinedFiltersStr) as Record<
          string,
          string[]
        >;
        for (const [col, values] of Object.entries(filters)) {
          if (!values || values.length === 0) continue;
          if (col === 'supplierCode' || col === 'maSoDoiTac') {
            whereConditions.push(
              `"p"."ma_so_doi_tac" = ANY($${queryParams.length + 1})`,
            );
            queryParams.push(values);
          } else if (col === 'supplierName' || col === 'tenDoiTac') {
            whereConditions.push(
              `"p"."ten_doi_tac" = ANY($${queryParams.length + 1})`,
            );
            queryParams.push(values);
          } else if (col === 'accountCode' || col === 'maSoTaiKhoan') {
            whereConditions.push(
              `"p"."ma_so_tai_khoan" = ANY($${queryParams.length + 1})`,
            );
            queryParams.push(values);
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
          if (col === 'supplierCode' || col === 'maSoDoiTac') {
            whereConditions.push(
              `"p"."ma_so_doi_tac" ILIKE $${queryParams.length + 1}`,
            );
            queryParams.push(`%${val.trim()}%`);
          } else if (col === 'supplierName' || col === 'tenDoiTac') {
            whereConditions.push(
              `"p"."ten_doi_tac" ILIKE $${queryParams.length + 1}`,
            );
            queryParams.push(`%${val.trim()}%`);
          }
        }
      } catch {
        // ignore
      }
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    const summarySql = `
      SELECT
        COUNT(DISTINCT "p"."doi_tac_id")::int AS total_suppliers,
        COALESCE(SUM("p"."ps_no"), 0)::numeric AS total_ps_no,
        COALESCE(SUM("p"."ps_co"), 0)::numeric AS total_ps_co,
        COALESCE(SUM("p"."ck_co"), 0)::numeric AS total_ck_co,
        COALESCE(SUM("p"."ck_no"), 0)::numeric AS total_ck_no,
        COALESCE(SUM(COALESCE("p"."ck_co", 0) - COALESCE("p"."ck_no", 0)), 0)::numeric AS total_balance,
        COALESCE(SUM(CASE WHEN (COALESCE("p"."ck_co", 0) - COALESCE("p"."ck_no", 0)) > 0 AND (CURRENT_DATE - DATE(COALESCE("p"."period_to", "p"."period_from", now()))) <= 30 THEN (COALESCE("p"."ck_co", 0) - COALESCE("p"."ck_no", 0)) ELSE 0 END), 0)::numeric AS total_aging_0_30,
        COALESCE(SUM(CASE WHEN (COALESCE("p"."ck_co", 0) - COALESCE("p"."ck_no", 0)) > 0 AND (CURRENT_DATE - DATE(COALESCE("p"."period_to", "p"."period_from", now()))) BETWEEN 31 AND 60 THEN (COALESCE("p"."ck_co", 0) - COALESCE("p"."ck_no", 0)) ELSE 0 END), 0)::numeric AS total_aging_31_60,
        COALESCE(SUM(CASE WHEN (COALESCE("p"."ck_co", 0) - COALESCE("p"."ck_no", 0)) > 0 AND (CURRENT_DATE - DATE(COALESCE("p"."period_to", "p"."period_from", now()))) BETWEEN 61 AND 90 THEN (COALESCE("p"."ck_co", 0) - COALESCE("p"."ck_no", 0)) ELSE 0 END), 0)::numeric AS total_aging_61_90,
        COALESCE(SUM(CASE WHEN (COALESCE("p"."ck_co", 0) - COALESCE("p"."ck_no", 0)) > 0 AND (CURRENT_DATE - DATE(COALESCE("p"."period_to", "p"."period_from", now()))) > 90 THEN (COALESCE("p"."ck_co", 0) - COALESCE("p"."ck_no", 0)) ELSE 0 END), 0)::numeric AS total_aging_over_90
      FROM "kgara_payables" "p"
      ${whereClause}
    `;

    const summaryResult = await this.payableRepo.manager.query(
      summarySql,
      queryParams,
    );
    const total = parseInt(summaryResult[0]?.total_suppliers || '0', 10);

    let orderClause = 'ORDER BY balance_amount DESC';
    if (sorts) {
      const sortList = Array.isArray(sorts) ? sorts : [sorts];
      const sortParts: string[] = [];
      for (const s of sortList) {
        const isDesc = s.startsWith('-');
        const col = isDesc ? s.substring(1) : s;
        const dir = isDesc ? 'DESC' : 'ASC';
        if (col === 'supplierCode' || col === 'maSoDoiTac')
          sortParts.push(`ma_so_doi_tac ${dir}`);
        else if (col === 'supplierName' || col === 'tenDoiTac')
          sortParts.push(`ten_doi_tac ${dir}`);
        else if (col === 'balance' || col === 'balanceAmount')
          sortParts.push(`balance_amount ${dir}`);
        else if (col === 'psNo') sortParts.push(`ps_no ${dir}`);
        else if (col === 'psCo') sortParts.push(`ps_co ${dir}`);
        else if (col === 'maxAgingDays' || col === 'aging')
          sortParts.push(`max_aging_days ${dir}`);
        else if (col === 'caseCount' || col === 'soVuViec')
          sortParts.push(`so_vu_viec ${dir}`);
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
        "p"."doi_tac_id",
        MAX(COALESCE("p"."ma_so_doi_tac", '')) AS ma_so_doi_tac,
        MAX(COALESCE("p"."ten_doi_tac", 'Chưa xác định')) AS ten_doi_tac,
        MAX(COALESCE("p"."ma_so_tai_khoan", '331')) AS ma_so_tai_khoan,
        MAX(COALESCE("p"."ten_tai_khoan", 'Phải trả người bán')) AS ten_tai_khoan,
        MAX(COALESCE("p"."ma_so_tien_te", 'VND')) AS ma_so_tien_te,
        COUNT(DISTINCT NULLIF("p"."ma_so_vu_viec", ''))::int AS so_vu_viec,
        COALESCE(SUM("p"."dk_no"), 0)::numeric AS dk_no,
        COALESCE(SUM("p"."dk_co"), 0)::numeric AS dk_co,
        COALESCE(SUM("p"."ps_no"), 0)::numeric AS ps_no,
        COALESCE(SUM("p"."ps_co"), 0)::numeric AS ps_co,
        COALESCE(SUM("p"."ck_no"), 0)::numeric AS ck_no,
        COALESCE(SUM("p"."ck_co"), 0)::numeric AS ck_co,
        COALESCE(SUM(COALESCE("p"."ck_co", 0) - COALESCE("p"."ck_no", 0)), 0)::numeric AS balance_amount,
        MIN("p"."period_from") AS period_from,
        MAX("p"."period_to") AS period_to,
        COALESCE(MAX(CASE WHEN (COALESCE("p"."ck_co", 0) - COALESCE("p"."ck_no", 0)) > 0 THEN CURRENT_DATE - DATE(COALESCE("p"."period_to", "p"."period_from", now())) ELSE 0 END), 0)::int AS max_aging_days,
        COALESCE(SUM(CASE WHEN (COALESCE("p"."ck_co", 0) - COALESCE("p"."ck_no", 0)) > 0 AND (CURRENT_DATE - DATE(COALESCE("p"."period_to", "p"."period_from", now()))) <= 30 THEN (COALESCE("p"."ck_co", 0) - COALESCE("p"."ck_no", 0)) ELSE 0 END), 0)::numeric AS aging_0_30,
        COALESCE(SUM(CASE WHEN (COALESCE("p"."ck_co", 0) - COALESCE("p"."ck_no", 0)) > 0 AND (CURRENT_DATE - DATE(COALESCE("p"."period_to", "p"."period_from", now()))) BETWEEN 31 AND 60 THEN (COALESCE("p"."ck_co", 0) - COALESCE("p"."ck_no", 0)) ELSE 0 END), 0)::numeric AS aging_31_60,
        COALESCE(SUM(CASE WHEN (COALESCE("p"."ck_co", 0) - COALESCE("p"."ck_no", 0)) > 0 AND (CURRENT_DATE - DATE(COALESCE("p"."period_to", "p"."period_from", now()))) BETWEEN 61 AND 90 THEN (COALESCE("p"."ck_co", 0) - COALESCE("p"."ck_no", 0)) ELSE 0 END), 0)::numeric AS aging_61_90,
        COALESCE(SUM(CASE WHEN (COALESCE("p"."ck_co", 0) - COALESCE("p"."ck_no", 0)) > 0 AND (CURRENT_DATE - DATE(COALESCE("p"."period_to", "p"."period_from", now()))) > 90 THEN (COALESCE("p"."ck_co", 0) - COALESCE("p"."ck_no", 0)) ELSE 0 END), 0)::numeric AS aging_over_90
      FROM "kgara_payables" "p"
      ${whereClause}
      GROUP BY "p"."doi_tac_id"
      ${orderClause}
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    const rawRows = await this.payableRepo.manager.query(dataSql, dataParams);

    const formattedData = rawRows.map((r: any) => ({
      supplierId: r.doi_tac_id,
      supplierCode: r.ma_so_doi_tac,
      supplierName: r.ten_doi_tac,
      accountCode: r.ma_so_tai_khoan,
      accountName: r.ten_tai_khoan,
      currency: r.ma_so_tien_te,
      caseCount: Number(r.so_vu_viec) || 0,
      dkNo: Number(r.dk_no) || 0,
      dkCo: Number(r.dk_co) || 0,
      psNo: Number(r.ps_no) || 0,
      psCo: Number(r.ps_co) || 0,
      ckNo: Number(r.ck_no) || 0,
      ckCo: Number(r.ck_co) || 0,
      balanceAmount: Number(r.balance_amount) || 0,
      periodFrom: r.period_from,
      periodTo: r.period_to,
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
        totalPsNo: Number(summaryResult[0]?.total_ps_no) || 0,
        totalPsCo: Number(summaryResult[0]?.total_ps_co) || 0,
        totalCkCo: Number(summaryResult[0]?.total_ck_co) || 0,
        totalCkNo: Number(summaryResult[0]?.total_ck_no) || 0,
        totalBalance: Number(summaryResult[0]?.total_balance) || 0,
        totalAging0_30: Number(summaryResult[0]?.total_aging_0_30) || 0,
        totalAging31_60: Number(summaryResult[0]?.total_aging_31_60) || 0,
        totalAging61_90: Number(summaryResult[0]?.total_aging_61_90) || 0,
        totalAgingOver90: Number(summaryResult[0]?.total_aging_over_90) || 0,
      },
    };
  }

  @Get('payables/suppliers-debt/column-options')
  @RequirePermissions({ resource: ErpResource.GARAGE, action: ErpAction.READ })
  async getSuppliersDebtColumnOptions(
    @BranchId() branchId: string,
    @Query('column') column: string,
    @Query('search') search: string = '',
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '20',
    @Query('filtersStr') filtersStr?: string,
  ) {
    let selectExpr = '"p"."ma_so_doi_tac"';
    if (column === 'supplierName' || column === 'tenDoiTac')
      selectExpr = '"p"."ten_doi_tac"';
    else if (column === 'supplierCode' || column === 'maSoDoiTac')
      selectExpr = '"p"."ma_so_doi_tac"';
    else if (column === 'accountCode' || column === 'maSoTaiKhoan')
      selectExpr = '"p"."ma_so_tai_khoan"';

    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const safePageSize = Math.max(parseInt(pageSize, 10) || 20, 1);

    const query = this.payableRepo
      .createQueryBuilder('p')
      .select(`DISTINCT ${selectExpr}`, 'value');

    if (branchId) {
      query.andWhere('p.branchExternalId = :branchId', { branchId });
    }
    query.andWhere(
      'COALESCE(p.periodTo, p.periodFrom, p.createdAt) >= :baselineDate',
      { baselineDate: '2026-07-01' },
    );
    query.andWhere(`${selectExpr} IS NOT NULL`);
    query.andWhere(`CAST(${selectExpr} AS TEXT) != ''`);

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

  @Get('payables/by-supplier/:supplierId/cases')
  @RequirePermissions({ resource: ErpResource.GARAGE, action: ErpAction.READ })
  async getCasesBySupplier(
    @BranchId() branchId: string,
    @Param('supplierId') supplierId: string,
  ) {
    const query = this.payableRepo
      .createQueryBuilder('p')
      .where('p.doiTacId = :supplierId', { supplierId })
      .andWhere(
        'COALESCE(p.periodTo, p.periodFrom, p.createdAt) >= :baselineDate',
        { baselineDate: '2026-07-01' },
      );

    if (branchId) {
      query.andWhere('p.branchExternalId = :branchId', { branchId });
    }

    query.orderBy('p.createdAt', 'DESC');

    const payables = await query.getMany();

    // Collect distinct case codes
    const caseCodes = Array.from(
      new Set(payables.map((p) => p.maSoVuViec).filter(Boolean)),
    );

    let linkedCases: KgaraCase[] = [];
    if (caseCodes.length > 0) {
      linkedCases = await this.caseRepo
        .createQueryBuilder('c')
        .where('c.soChungTu IN (:...caseCodes)', { caseCodes })
        .andWhere('c.kgaraDeletedAt IS NULL')
        .getMany();
    }

    const caseMap = new Map<string, KgaraCase>();
    for (const c of linkedCases) {
      if (c.soChungTu) caseMap.set(c.soChungTu, c);
    }

    const enrichedPayables = payables.map((p) => {
      const linkedCase = p.maSoVuViec ? caseMap.get(p.maSoVuViec) : null;
      return {
        ...p,
        linkedCase: linkedCase || null,
        balance: (Number(p.ckCo) || 0) - (Number(p.ckNo) || 0),
      };
    });

    return {
      payables: enrichedPayables,
      linkedCases,
    };
  }
}
