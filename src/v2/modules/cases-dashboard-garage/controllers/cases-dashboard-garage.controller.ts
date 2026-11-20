import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CoreRbacGuard } from '@/auth/guards/core-rbac.guard';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import { ErpAction, ErpResource } from '@/v2/core/rbac-core';
import {
  CaseDashboardCasesQueryDto,
  CaseDashboardPeriodQueryDto,
  CaseDashboardRangeQueryDto,
} from '../dto/case-dashboard-query.dto';
import { CasesDashboardGarageService } from '../services/cases-dashboard-garage.service';

const DASHBOARD_READ = { resource: ErpResource.GARAGE, action: ErpAction.READ };

/** Tham số HTTP của drill-down (lệnh/xe) sang input của facade. */
const toDrillInput = (q: CaseDashboardCasesQueryDto) => ({
  dateFrom: q.date_from,
  dateTo: q.date_to,
  stage: q.stage,
  classification: q.classification,
  page: q.page,
  pageSize: q.pageSize,
});

/**
 * Dashboard garage V2 (chỉ đọc `cases_garage`). Mọi số XE là số biển khác nhau;
 * số lệnh và tiền cộng theo lệnh.
 */
@ApiTags('cases-dashboard-garage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('api/v2/cases-dashboard-garage')
export class CasesDashboardGarageController {
  constructor(private readonly dashboard: CasesDashboardGarageService) {}

  @RequirePermissions(DASHBOARD_READ)
  @ApiOperation({ summary: 'KPI tháng/tuần/ngày và dự thu' })
  @Get('period-kpis')
  periodKpis(@Query() q: CaseDashboardPeriodQueryDto) {
    return this.dashboard.getPeriodKpis(q.date);
  }

  @RequirePermissions(DASHBOARD_READ)
  @ApiOperation({ summary: 'Phễu giai đoạn theo khoảng ngày' })
  @Get('funnel')
  funnel(@Query() q: CaseDashboardRangeQueryDto) {
    return this.dashboard.getFunnel(q.date_from, q.date_to);
  }

  @RequirePermissions(DASHBOARD_READ)
  @ApiOperation({ summary: 'Danh sách lệnh (drill-down) của dashboard' })
  @Get('cases')
  cases(@Query() q: CaseDashboardCasesQueryDto) {
    return this.dashboard.listCases(toDrillInput(q));
  }

  @RequirePermissions(DASHBOARD_READ)
  @ApiOperation({
    summary: 'Danh sách xe (drill-down theo xe) của dashboard, kèm các lệnh',
  })
  @Get('vehicles')
  vehicles(@Query() q: CaseDashboardCasesQueryDto) {
    return this.dashboard.listVehicles(toDrillInput(q));
  }
}
