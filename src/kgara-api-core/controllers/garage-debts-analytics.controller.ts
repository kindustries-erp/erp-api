import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../../auth/guards/core-rbac.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { ErpResource, ErpAction } from '@/rbac-core/enums';
import { GarageDebtsAnalyticsService } from '../services/garage-debts-analytics.service';
import {
  GetGarageDebtsAnalyticsQueryDto,
  GetGarageTimeHorizonCasesQueryDto,
} from '../dto/garage-debts-analytics.dto';

@ApiTags('garage_debts_analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('greenway/dashboard')
export class GarageDebtsAnalyticsController {
  constructor(private readonly service: GarageDebtsAnalyticsService) {}

  @RequirePermissions({ resource: ErpResource.GARAGE, action: ErpAction.READ })
  @Get('debts-analytics')
  @ApiQuery({ name: 'date_from', required: false })
  @ApiQuery({ name: 'date_to', required: false })
  @ApiQuery({ name: 'branch_id', required: false })
  getDebtsAnalytics(@Query() query: GetGarageDebtsAnalyticsQueryDto) {
    return this.service.getDebtsAnalytics(
      query.date_from,
      query.date_to,
      query.branch_id,
    );
  }

  @RequirePermissions({ resource: ErpResource.GARAGE, action: ErpAction.READ })
  @Get('time-horizons/:horizon/cases')
  @ApiQuery({ name: 'date_from', required: false })
  @ApiQuery({ name: 'date_to', required: false })
  @ApiQuery({ name: 'branch_id', required: false })
  @ApiQuery({ name: 'direction', required: false, enum: ['ALL', 'IN', 'OUT'] })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiQuery({ name: 'sortBy', required: false })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['ASC', 'DESC'] })
  @ApiQuery({ name: 'column_search', required: false })
  @ApiQuery({ name: 'column_filters', required: false })
  getTimeHorizonCases(
    @Param('horizon') horizon: string,
    @Query() query: GetGarageTimeHorizonCasesQueryDto,
  ) {
    return this.service.getTimeHorizonCases(horizon, query);
  }
}
