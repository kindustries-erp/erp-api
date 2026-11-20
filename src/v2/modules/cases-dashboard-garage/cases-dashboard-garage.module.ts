import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CaseGarage } from '../cases-garage/entities/case-garage.entity';
import { CasesDashboardGarageController } from './controllers/cases-dashboard-garage.controller';
import { CaseDashboardCasesQueryService } from './services/case-dashboard-cases-query.service';
import { CaseDashboardFunnelQueryService } from './services/case-dashboard-funnel-query.service';
import { CaseDashboardKpiQueryService } from './services/case-dashboard-kpi-query.service';
import { CaseDashboardVehiclesQueryService } from './services/case-dashboard-vehicles-query.service';
import { CasesDashboardGarageService } from './services/cases-dashboard-garage.service';

/**
 * Dashboard garage v2: đọc `cases_garage` (không có bảng mới). Route `api/v2/cases-dashboard-garage`,
 * quyền `GARAGE` (READ).
 */
@Module({
  imports: [TypeOrmModule.forFeature([CaseGarage])],
  controllers: [CasesDashboardGarageController],
  providers: [
    CaseDashboardKpiQueryService,
    CaseDashboardFunnelQueryService,
    CaseDashboardCasesQueryService,
    CaseDashboardVehiclesQueryService,
    CasesDashboardGarageService,
  ],
  exports: [CasesDashboardGarageService],
})
export class CasesDashboardGarageModule {}
