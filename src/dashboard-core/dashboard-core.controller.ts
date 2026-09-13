import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../auth/guards/core-rbac.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { DashboardCoreService } from './dashboard-core.service';

@ApiTags('dashboard_core')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard-core')
export class DashboardCoreController {
  constructor(private readonly dashboardCoreService: DashboardCoreService) {}

  @Get('overview')
  getOverview(@Query() query: any) {
    return this.dashboardCoreService.getOverview(query);
  }

  @Get('cashflow-forecast')
  getCashflowForecast(@Query() query: any) {
    return this.dashboardCoreService.getCashflowForecast(query);
  }

  @Get('budget-suggestions')
  getBudgetSuggestions(@Query() query: any) {
    return this.dashboardCoreService.getBudgetSuggestions(query);
  }
}
