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
import { ErpBranchId } from '@/v2/core/branches-core';
import { QueryCaseProgressDto } from '../dto/case-progress.dto';
import { QueryCasesGarageDto } from '../dto/query-cases-garage.dto';
import { CaseColumnOptionsService } from '../services/case-column-options.service';
import { CaseDetailQueryService } from '../services/case-detail-query.service';
import { CaseProgressQueryService } from '../services/case-progress-query.service';
import { CaseListQueryService } from '../services/case-list-query.service';
import { CaseServicesQueryService } from '../services/case-services-query.service';
import { GrossProfitReportService } from '../services/gross-profit-report.service';

const GARAGE_READ = { resource: ErpResource.GARAGE, action: ErpAction.READ };

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
    private readonly progress: CaseProgressQueryService,
  ) {}

  @RequirePermissions(GARAGE_READ)
  @ApiOperation({ summary: 'Danh sách vụ việc' })
  @Get()
  listCases(
    @Query() q: QueryCasesGarageDto,
    @ErpBranchId() branchId: string | undefined,
  ) {
    return this.list.findPage({
      branchId,
      page: q.page,
      pageSize: q.pageSize,
      search: q.search,
      from: q.date_from,
      to: q.date_to,
      origin: q.origin,
      column_filters: q.column_filters,
      column_search: q.column_search,
      column_operators: q.column_operators,
      date_ranges: q.date_ranges,
      sort: q.sort,
      summaryKeys: q.summary_keys,
    });
  }

  @RequirePermissions(GARAGE_READ)
  @ApiOperation({ summary: 'Bảng theo dõi tiến độ xe (mặc định xe đang sửa)' })
  @Get('progress')
  progressBoard(
    @Query() q: QueryCaseProgressDto,
    @ErpBranchId() branchId: string | undefined,
  ) {
    return this.progress.findPage(branchId, q);
  }

  @RequirePermissions(GARAGE_READ)
  @ApiOperation({ summary: 'Gợi ý giá trị cột của danh sách vụ việc' })
  @Get('column-options')
  columnOptions(
    @Query('column') column: string,
    @ErpBranchId() branchId: string | undefined,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('filters') filters?: string,
  ) {
    return this.options.findOptions(branchId, column, {
      search,
      page: Number(page) || undefined,
      pageSize: Number(pageSize) || undefined,
      filters,
    });
  }

  @RequirePermissions(GARAGE_READ)
  @ApiOperation({ summary: 'Hạng mục dịch vụ và phụ tùng của vụ việc' })
  @Get('services')
  listServices(
    @Query() q: QueryCasesGarageDto,
    @ErpBranchId() branchId: string | undefined,
  ) {
    return this.services.findPage({
      branchId,
      page: q.page,
      pageSize: q.pageSize,
      search: q.search,
      from: q.date_from,
      to: q.date_to,
      serviceType: q.serviceType,
      origin: q.origin,
      column_filters: q.column_filters,
      column_search: q.column_search,
      column_operators: q.column_operators,
      date_ranges: q.date_ranges,
      sort: q.sort,
      summaryKeys: q.summary_keys,
    });
  }

  @RequirePermissions(GARAGE_READ)
  @ApiOperation({ summary: 'Báo cáo lợi nhuận gộp theo vụ việc' })
  @Get('gross-profit-report')
  grossProfitReport(
    @Query() q: QueryCasesGarageDto,
    @ErpBranchId() branchId: string | undefined,
  ) {
    return this.grossProfit.getReport({
      branchId,
      from: q.date_from,
      to: q.date_to,
      page: q.page,
      pageSize: q.pageSize,
    });
  }

  @RequirePermissions(GARAGE_READ)
  @ApiOperation({ summary: 'Chi tiết vụ việc theo mã chứng từ' })
  @Get('by-code/:code')
  byCode(
    @Param('code') code: string,
    @ErpBranchId() branchId: string | undefined,
  ) {
    return this.detail.findByCode(branchId, code);
  }

  @RequirePermissions(GARAGE_READ)
  @ApiOperation({ summary: 'Chi tiết vụ việc theo id' })
  @Get(':id')
  byId(
    @Param('id', new ParseUUIDPipe()) id: string,
    @ErpBranchId() branchId: string | undefined,
  ) {
    return this.detail.findById(branchId, id);
  }
}
