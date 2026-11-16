import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CoreRbacGuard } from '@/auth/guards/core-rbac.guard';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import { ErpAction, ErpResource } from '@/v2/core/rbac-core';
import { BranchId } from '@/kgara-api-core/decorators/branch-id.decorator';
import { QueryCasesGarageDto } from '../dto/query-cases-garage.dto';
import { CaseColumnOptionsService } from '../services/case-column-options.service';
import { CaseDetailQueryService } from '../services/case-detail-query.service';
import { CaseListQueryService } from '../services/case-list-query.service';
import { CaseServicesQueryService } from '../services/case-services-query.service';
import { GrossProfitReportService } from '../services/gross-profit-report.service';

const GARAGE_READ = { resource: ErpResource.GARAGE, action: ErpAction.READ };

/** Chi nhánh lấy từ header; vụ việc luôn phải cách ly theo chi nhánh. */
function requireBranch(branchId: string | undefined): string {
  if (!branchId) throw new BadRequestException('Thiếu chi nhánh.');
  return branchId;
}

/**
 * Vụ việc Kgara v2 (chỉ đọc). Route cố định khai báo trước `:id` để không bị `:id` nuốt.
 * Response list: `{ items, pagination, summaries }`.
 */
@ApiTags('cases-garage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('api/v2/cases-garage')
export class CasesGarageController {
  constructor(
    private readonly list: CaseListQueryService,
    private readonly options: CaseColumnOptionsService,
    private readonly detail: CaseDetailQueryService,
    private readonly services: CaseServicesQueryService,
    private readonly grossProfit: GrossProfitReportService,
  ) {}

  @RequirePermissions(GARAGE_READ)
  @ApiOperation({ summary: 'Danh sách vụ việc' })
  @Get()
  listCases(@Query() q: QueryCasesGarageDto, @BranchId() branchId: string) {
    return this.list.findPage({
      branchId: requireBranch(branchId),
      page: q.page,
      pageSize: q.pageSize,
      search: q.search,
      from: q.date_from,
      to: q.date_to,
      columnFilters: q.column_filters,
      sort: q.sort,
      summaryKeys: q.summary_keys,
    });
  }

  @RequirePermissions(GARAGE_READ)
  @ApiOperation({ summary: 'Gợi ý giá trị cột của danh sách vụ việc' })
  @Get('column-options')
  columnOptions(
    @Query('column') column: string,
    @BranchId() branchId: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('filters') filters?: string,
  ) {
    return this.options.findOptions(requireBranch(branchId), column, {
      search,
      page: Number(page) || undefined,
      pageSize: Number(pageSize) || undefined,
      filters,
    });
  }

  @RequirePermissions(GARAGE_READ)
  @ApiOperation({ summary: 'Hạng mục dịch vụ và phụ tùng của vụ việc' })
  @Get('services')
  listServices(@Query() q: QueryCasesGarageDto, @BranchId() branchId: string) {
    return this.services.findPage({
      branchId: requireBranch(branchId),
      page: q.page,
      pageSize: q.pageSize,
      search: q.search,
      from: q.date_from,
      to: q.date_to,
      serviceType: q.serviceType,
      columnFilters: q.column_filters,
      sort: q.sort,
      summaryKeys: q.summary_keys,
    });
  }

  @RequirePermissions(GARAGE_READ)
  @ApiOperation({ summary: 'Báo cáo lợi nhuận gộp theo vụ việc' })
  @Get('gross-profit-report')
  grossProfitReport(
    @Query() q: QueryCasesGarageDto,
    @BranchId() branchId: string,
  ) {
    return this.grossProfit.getReport({
      branchId: requireBranch(branchId),
      from: q.date_from,
      to: q.date_to,
      page: q.page,
      pageSize: q.pageSize,
    });
  }

  @RequirePermissions(GARAGE_READ)
  @ApiOperation({ summary: 'Chi tiết vụ việc theo mã chứng từ' })
  @Get('by-code/:code')
  byCode(@Param('code') code: string, @BranchId() branchId: string) {
    return this.detail.findByCode(requireBranch(branchId), code);
  }

  @RequirePermissions(GARAGE_READ)
  @ApiOperation({ summary: 'Chi tiết vụ việc theo id' })
  @Get(':id')
  byId(
    @Param('id', new ParseUUIDPipe()) id: string,
    @BranchId() branchId: string,
  ) {
    return this.detail.findById(requireBranch(branchId), id);
  }
}
