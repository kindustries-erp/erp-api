import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KgaraBranch } from '@/kgara-api-core/entities/kgara_branch.entity';
import { ErpModuleCategory } from '@/module-config/entities/erp_module_category.entity';
import { KgaraCaseLinkedInvoice } from '@/kgara-api-core/entities/kgara_case_linked_invoice.entity';
import { KgaraCaseSettlement } from '@/kgara-api-core/entities/kgara_case_settlement.entity';
import { KgaraGrossProfit } from '@/kgara-api-core/entities/kgara_gross_profit.entity';
import { CaseGarage } from './entities/case-garage.entity';
import { CaseLineGarage } from './entities/case-line-garage.entity';
import { CaseProgressLogGarage } from './entities/case-progress-log-garage.entity';
import { GARAGE_CASE_PROJECTOR } from '@/kgara-api-core/hub/case-projector.port';
import { CasesGarageService } from './cases-garage.service';
import { CasesGarageCommandsController } from './controllers/cases-garage-commands.controller';
import { CasesGarageController } from './controllers/cases-garage.controller';
import { CasesGarageWorkshopController } from './controllers/cases-garage-workshop.controller';
import { CaseProgressLogCommandService } from './services/case-progress-log-command.service';
import { CaseWorkshopQueryService } from './services/case-workshop-query.service';
import { CaseWorkshopCandidatesService } from './services/case-workshop-candidates.service';
import { CaseWorkshopTrackService } from './services/case-workshop-track.service';
import { CaseWorkshopWorkersService } from './services/case-workshop-workers.service';
import { CaseCommandService } from './services/case-command.service';
import { CaseProgressCommandService } from './services/case-progress-command.service';
import { CaseProgressQueryService } from './services/case-progress-query.service';
import { CaseRevertService } from './services/case-revert.service';
import { CaseLineCommandService } from './services/case-line-command.service';
import { CaseProjectorService } from './services/case-projector.service';
import { CaseLineWriter } from './services/case-line-writer.service';
import { CaseColumnOptionsService } from './services/case-column-options.service';
import { CaseDetailQueryService } from './services/case-detail-query.service';
import { CaseServicesQueryService } from './services/case-services-query.service';
import { CaseListEnrichmentService } from './services/case-list-enrichment.service';
import { CaseListQueryService } from './services/case-list-query.service';
import { GrossProfitReportService } from './services/gross-profit-report.service';

/**
 * Vụ việc garage v2: CRUD trên `cases_garage` + `case_lines_garage` (xe nhập tay `NATIVE`) và bản chiếu
 * xe KGARA_SYNC từ V1 qua `CaseProjectorService` (sửa đè ở v2 bằng `overrides`, không ghi ngược KGara). Route `api/v2/cases-garage`, quyền `GARAGE`
 * (READ/CREATE/UPDATE/DELETE). Số liệu cấn trừ/hóa đơn liên kết/lãi gộp vẫn đọc từ `kgara_*` (cùng UUID).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ErpModuleCategory,
      KgaraGrossProfit,
      KgaraCaseSettlement,
      KgaraCaseLinkedInvoice,
      KgaraBranch,
      CaseGarage,
      CaseLineGarage,
      CaseProgressLogGarage,
    ]),
  ],
  // Controller ghi đứng trước để route tĩnh (`next-code`) không bị `GET :id` nuốt.
  controllers: [
    CasesGarageWorkshopController,
    CasesGarageCommandsController,
    CasesGarageController,
  ],
  providers: [
    CaseListEnrichmentService,
    CaseListQueryService,
    CaseColumnOptionsService,
    CaseDetailQueryService,
    GrossProfitReportService,
    CaseServicesQueryService,
    CasesGarageService,
    CaseCommandService,
    CaseLineCommandService,
    CaseLineWriter,
    CaseRevertService,
    CaseProgressCommandService,
    CaseProgressLogCommandService,
    CaseWorkshopQueryService,
    CaseWorkshopWorkersService,
    CaseWorkshopCandidatesService,
    CaseWorkshopTrackService,
    CaseProgressQueryService,
    CaseProjectorService,
    { provide: GARAGE_CASE_PROJECTOR, useExisting: CaseProjectorService },
  ],
  exports: [
    CaseListQueryService,
    CaseColumnOptionsService,
    CaseDetailQueryService,
    GrossProfitReportService,
    CaseServicesQueryService,
    CasesGarageService,
    CaseProjectorService,
    GARAGE_CASE_PROJECTOR,
  ],
})
export class CasesGarageModule {}
