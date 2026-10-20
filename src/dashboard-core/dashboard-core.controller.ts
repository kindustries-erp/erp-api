import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../auth/guards/core-rbac.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { ErpResource, ErpAction } from '@/rbac-core/enums';
import { DashboardCoreService } from './dashboard-core.service';
import {
  DashboardOverviewQueryDto,
  DashboardForecastQueryDto,
  DashboardBudgetQueryDto,
} from './dto/dashboard-query.dto';

@ApiTags('dashboard_core')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('dashboard-core')
export class DashboardCoreController {
  constructor(private readonly dashboardCoreService: DashboardCoreService) {}

  @RequirePermissions({
    resource: ErpResource.DASHBOARD,
    action: ErpAction.READ,
  })
  @ApiOperation({ summary: 'Lấy dữ liệu tổng quan bảng điều khiển' })
  @Get('overview')
  getOverview(@Query() query: DashboardOverviewQueryDto) {
    return this.dashboardCoreService.getOverview(query);
  }

  @RequirePermissions({
    resource: ErpResource.DASHBOARD,
    action: ErpAction.READ,
  })
  @ApiOperation({ summary: 'Dự báo dòng tiền ngân sách' })
  @Get('cashflow-forecast')
  getCashflowForecast(@Query() query: DashboardForecastQueryDto) {
    return this.dashboardCoreService.getCashflowForecast(query);
  }

  @RequirePermissions({
    resource: ErpResource.DASHBOARD,
    action: ErpAction.READ,
  })
  @ApiOperation({ summary: 'Gợi ý ngân sách từ sao kê' })
  @Get('budget-suggestions')
  getBudgetSuggestions(@Query() query: DashboardBudgetQueryDto) {
    return this.dashboardCoreService.getBudgetSuggestions(query);
  }
}
