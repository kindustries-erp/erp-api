import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CoreRbacGuard } from '@/auth/guards/core-rbac.guard';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import { ErpAction, ErpResource } from '@/v2/core/rbac-core';
import {
  CaseDashboardListQueryDto,
  CaseDashboardOverviewQueryDto,
} from '../dto/case-dashboard-query.dto';
import { CasesDashboardGarageService } from '../services/cases-dashboard-garage.service';

const DASHBOARD_READ = { resource: ErpResource.GARAGE, action: ErpAction.READ };

/** Tham số HTTP của danh sách xe sang input của facade. */
const toListInput = (q: CaseDashboardListQueryDto) => ({
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
 *
 * Hai route: `GET /` (danh sách xe drill-down, phân trang theo xe) và `GET /overview`
 * (KPI kỳ và phễu, không đổi khi đổi trang nên tách riêng).
 */
@ApiTags('cases-dashboard-garage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('api/v2/cases-dashboard-garage')
export class CasesDashboardGarageController {
  constructor(private readonly dashboard: CasesDashboardGarageService) {}

  @RequirePermissions(DASHBOARD_READ)
  @ApiOperation({
    summary: 'KPI tháng/tuần/ngày, dự thu và phễu giai đoạn trong một lần gọi',
  })
  @Get('overview')
  overview(@Query() q: CaseDashboardOverviewQueryDto) {
    return this.dashboard.getOverview(q.date, q.date_from, q.date_to);
  }

  @RequirePermissions(DASHBOARD_READ)
  @ApiOperation({
    summary:
      'Danh sách xe (drill-down) của dashboard, kèm các lệnh của từng xe',
  })
  @Get()
  list(@Query() q: CaseDashboardListQueryDto) {
    return this.dashboard.listVehicles(toListInput(q));
  }
}
