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
import { KgaraCustomersDebtQueryService } from '../services/kgara-customers-debt-query.service';

@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('greenway')
export class KgaraCustomersController {
  constructor(
    @InjectRepository(KgaraCase)
    private readonly caseRepo: Repository<KgaraCase>,
    @InjectRepository(KgaraCaseSettlement)
    private readonly settlementRepo: Repository<KgaraCaseSettlement>,
    private readonly customerCasesDetailService: KgaraCustomerCasesDetailService,
    private readonly customersDebtQueryService: KgaraCustomersDebtQueryService,
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
    return this.customersDebtQueryService.getCustomersDebt(branchId, {
      page,
      pageSize,
      q,
      from,
      to,
      sorts,
      filtersStr,
      columnFiltersParam,
      columnSearchParam,
    });
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
    if (column === 'totalAmount' || column === 'totalRevenue') {
      const options = [
        { label: '< 10.000.000 đ', value: '0-10m' },
        { label: '10.000.000 - 20.000.000 đ', value: '10m-20m' },
        { label: '20.000.000 - 50.000.000 đ', value: '20m-50m' },
        { label: '> 50.000.000 đ', value: '>50m' },
      ];
      const filtered = search
        ? options.filter(
            (opt) =>
              opt.label.toLowerCase().includes(search.toLowerCase()) ||
              opt.value.toLowerCase().includes(search.toLowerCase()),
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

    if (column === 'balanceAmount' || column === 'balance') {
      const options = [
        { label: '0 đ (Đã thanh toán hết)', value: '0' },
        { label: '< 10.000.000 đ', value: '0-10m' },
        { label: '10.000.000 - 20.000.000 đ', value: '10m-20m' },
        { label: '20.000.000 - 50.000.000 đ', value: '20m-50m' },
        { label: '> 50.000.000 đ', value: '>50m' },
      ];
      const filtered = search
        ? options.filter(
            (opt) =>
              opt.label.toLowerCase().includes(search.toLowerCase()) ||
              opt.value.toLowerCase().includes(search.toLowerCase()),
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
    @Query('licensePlate') licensePlate?: string,
  ) {
    return this.customerCasesDetailService.getCasesByCustomer(
      branchId,
      customerCode,
      licensePlate,
    );
  }
}
