import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CoreRbacGuard } from '@/auth/guards/core-rbac.guard';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import { ErpAction, ErpResource } from '@/v2/core/rbac-core';
import { BranchId } from '@/kgara-api-core/decorators/branch-id.decorator';
import { QueryGarageDebtDto } from '../dto/query-garage-debt.dto';
import { QueryTimeHorizonCasesDto } from '../dto/query-time-horizon-cases.dto';
import { parseOptionsFilters } from '../helpers/column-options-filters.helper';
import { CustomerDebtQueryService } from '../services/customer-debt-query.service';
import { DebtsAnalyticsService } from '../services/debts-analytics.service';
import { SupplierDebtQueryService } from '../services/supplier-debt-query.service';
import { TimeHorizonCasesService } from '../services/time-horizon-cases.service';

const DEBTS_READ = {
  resource: ErpResource.GARAGE_DEBTS,
  action: ErpAction.READ,
};

/** Mốc thời gian hợp lệ của drawer analytics. */
export const TIME_HORIZONS = [
  'nextWeekDue',
  'nextMonthDue',
  'overdue30To90',
  'criticalOverdue90Plus',
  'forecastNext7Days',
  'forecastNext30Days',
  'expectedCashflow',
  'defaultRiskProvision',
] as const;

/** Chi nhánh lấy từ header; công nợ luôn phải cách ly theo chi nhánh. */
function requireBranch(branchId: string | undefined): string {
  if (!branchId) throw new BadRequestException('Thiếu chi nhánh.');
  return branchId;
}

/**
 * Công nợ garage v2 (chỉ đọc). Route cố định (`column-options`, `analytics`) đứng trước route có tham số.
 * Response list: `{ items, pagination, summaries }`.
 */
@ApiTags('debts-garage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('api/v2/debts-garage')
export class DebtsGarageController {
  constructor(
    private readonly customers: CustomerDebtQueryService,
    private readonly suppliers: SupplierDebtQueryService,
    private readonly analytics: DebtsAnalyticsService,
    private readonly horizons: TimeHorizonCasesService,
  ) {}

  @RequirePermissions(DEBTS_READ)
  @ApiOperation({ summary: 'Công nợ phải thu khách hàng (gom theo biển số)' })
  @Get('customers')
  customersList(
    @Query() query: QueryGarageDebtDto,
    @BranchId() branchId: string,
  ) {
    return this.customers.findPage({
      ...query,
      branchId: requireBranch(branchId),
      from: query.date_from,
      to: query.date_to,
    });
  }

  @RequirePermissions(DEBTS_READ)
  @ApiOperation({ summary: 'Gợi ý giá trị cột công nợ khách hàng' })
  @Get('customers/column-options')
  customersColumnOptions(
    @Query('column') column: string,
    @BranchId() branchId: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('filters') filters?: string,
  ) {
    return this.customers.findColumnOptions(
      column,
      { search, page, pageSize, filters: parseOptionsFilters(filters) },
      { branchId: requireBranch(branchId) },
    );
  }

  @RequirePermissions(DEBTS_READ)
  @ApiOperation({ summary: 'Công nợ phải trả nhà cung cấp (gom theo biển số)' })
  @Get('suppliers')
  suppliersList(
    @Query() query: QueryGarageDebtDto,
    @BranchId() branchId: string,
  ) {
    return this.suppliers.findPage({
      ...query,
      branchId: requireBranch(branchId),
      from: query.date_from,
      to: query.date_to,
    });
  }

  @RequirePermissions(DEBTS_READ)
  @ApiOperation({ summary: 'Gợi ý giá trị cột công nợ nhà cung cấp' })
  @Get('suppliers/column-options')
  suppliersColumnOptions(
    @Query('column') column: string,
    @BranchId() branchId: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('filters') filters?: string,
  ) {
    return this.suppliers.findColumnOptions(
      column,
      { search, page, pageSize, filters: parseOptionsFilters(filters) },
      { branchId: requireBranch(branchId) },
    );
  }

  @RequirePermissions(DEBTS_READ)
  @ApiOperation({ summary: 'Tổng quan phân tích công nợ phải thu và phải trả' })
  @Get('analytics')
  analyticsOverview(
    @BranchId() branchId: string,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
  ) {
    return this.analytics.getAnalytics({
      branchId: requireBranch(branchId),
      dateFrom,
      dateTo,
    });
  }

  @RequirePermissions(DEBTS_READ)
  @ApiOperation({ summary: 'Vụ việc còn nợ theo mốc thời gian' })
  @Get('analytics/time-horizons/:horizon/cases')
  horizonCases(
    @Param('horizon') horizon: string,
    @Query() query: QueryTimeHorizonCasesDto,
    @BranchId() branchId: string,
  ) {
    if (!(TIME_HORIZONS as readonly string[]).includes(horizon)) {
      throw new BadRequestException('Mốc thời gian không hợp lệ.');
    }
    return this.horizons.findCases({
      horizon,
      branchId: requireBranch(branchId),
      dateFrom: query.date_from,
      dateTo: query.date_to,
      search: query.search,
      page: query.page,
      pageSize: query.pageSize,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });
  }
}
