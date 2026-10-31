import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CoreRbacGuard } from '@/auth/guards/core-rbac.guard';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import { ErpAction } from '@/rbac-core/enums/erp-action.enum';
import { ErpResource } from '@/rbac-core/enums/erp-resource.enum';
import { AdminDashboardStatsService } from './services/admin-dashboard-stats.service';
import {
  AdminDashboardQueryDto,
  AdminDashboardSummaryResponseDto,
} from './dto/admin-dashboard-summary.dto';

@ApiTags('admin-dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('api/v2/admin/dashboard')
export class AdminDashboardController {
  constructor(
    private readonly adminDashboardStatsService: AdminDashboardStatsService,
  ) {}

  @RequirePermissions({
    resource: ErpResource.DASHBOARD,
    action: ErpAction.READ,
  })
  @ApiOperation({
    summary: 'Lấy dữ liệu tổng quan cho Executive Dashboard Admin',
  })
  @ApiResponse({
    status: 200,
    description: 'Dữ liệu tổng quan dashboard',
    type: AdminDashboardSummaryResponseDto,
  })
  @Get('summary')
  async getSummary(
    @Query() query: AdminDashboardQueryDto,
  ): Promise<AdminDashboardSummaryResponseDto> {
    return this.adminDashboardStatsService.getSummary(query);
  }
}
