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
import {
  RequireAnyPermissions,
  RequirePermissions,
} from '@/auth/decorators/require-permissions.decorator';
import { ErpAction, ErpResource } from '@/v2/core/rbac-core';
import { ErpBranchId } from '@/v2/core/branches-core';
import {
  CheckCashflowDuplicateGarageDto,
  QueryCashflowVoucherGarageDto,
} from '../dto/query-cashflow-voucher-garage.dto';
import { CashflowVoucherGarageInsightService } from '../services/cashflow-voucher-garage-insight.service';
import { CashflowVoucherGarageQueryService } from '../services/cashflow-voucher-garage-query.service';

const CASHFLOW = ErpResource.GARAGE_CASHFLOW;
const READ = { resource: CASHFLOW, action: ErpAction.READ };

/**
 * Phiếu thu chi garage v2 (chỉ đọc). Lệnh ghi đi qua orchestrator `debts-flow-garage`.
 * Route cố định (`column-options`, `dashboard`, `duplicate-check`) đứng trước `:id`.
 */
@ApiTags('cashflow-vouchers-garage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('api/v2/cashflow-vouchers-garage')
export class CashflowVouchersGarageController {
  constructor(
    private readonly query: CashflowVoucherGarageQueryService,
    private readonly insight: CashflowVoucherGarageInsightService,
  ) {}

  @RequirePermissions(READ)
  @ApiOperation({ summary: 'Danh sách phiếu thu chi garage' })
  @Get()
  list(
    @Query() q: QueryCashflowVoucherGarageDto,
    @ErpBranchId() branchId: string | undefined,
  ) {
    return this.query.findPage({ ...q, branchId });
  }

  @RequirePermissions(READ)
  @ApiOperation({ summary: 'Gợi ý giá trị cột phiếu thu chi' })
  @Get('column-options')
  columnOptions(
    @Query('column') column: string,
    @ErpBranchId() branchId: string | undefined,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.query.findColumnOptions(
      column,
      { search, page, pageSize },
      { branchId },
    );
  }

  @RequirePermissions(READ)
  @ApiOperation({ summary: 'Số tổng thu chi của kỳ' })
  @Get('dashboard')
  dashboard(
    @ErpBranchId() branchId: string | undefined,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
  ) {
    return this.insight.getDashboard(branchId, {
      from: dateFrom,
      to: dateTo,
    });
  }

  @RequireAnyPermissions(
    { resource: CASHFLOW, action: ErpAction.CREATE },
    { resource: CASHFLOW, action: ErpAction.UPDATE },
  )
  @ApiOperation({ summary: 'Cảnh báo phiếu có thể trùng' })
  @Get('duplicate-check')
  duplicateCheck(
    @Query() q: CheckCashflowDuplicateGarageDto,
    @ErpBranchId() branchId: string | undefined,
  ) {
    return this.insight.findPotentialDuplicates(branchId, q);
  }

  @RequirePermissions(READ)
  @ApiOperation({ summary: 'Chi tiết một phiếu' })
  @Get(':id')
  detail(
    @Param('id', ParseUUIDPipe) id: string,
    @ErpBranchId() branchId: string | undefined,
  ) {
    return this.query.findOne(branchId, id);
  }
}
