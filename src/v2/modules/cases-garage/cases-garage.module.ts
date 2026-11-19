import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KgaraBranch } from '@/kgara-api-core/entities/kgara_branch.entity';
import { ErpModuleCategory } from '@/module-config/entities/erp_module_category.entity';
import { KgaraCaseLinkedInvoice } from '@/kgara-api-core/entities/kgara_case_linked_invoice.entity';
import { KgaraCaseSettlement } from '@/kgara-api-core/entities/kgara_case_settlement.entity';
import { KgaraGrossProfit } from '@/kgara-api-core/entities/kgara_gross_profit.entity';
import { CaseGarage } from './entities/case-garage.entity';
import { CaseServiceGarage } from './entities/case-service-garage.entity';
import { GARAGE_CASE_PROJECTOR } from '@/kgara-api-core/hub/case-projector.port';
import { CasesGarageService } from './cases-garage.service';
import { CasesGarageCommandsController } from './controllers/cases-garage-commands.controller';
import { CasesGarageController } from './controllers/cases-garage.controller';
import { CaseCommandService } from './services/case-command.service';
import { CaseKgaraMirrorService } from './services/case-kgara-mirror.service';
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
 * Vụ việc garage v2: CRUD trên `cases_garage` + `case_services_garage` (xe nhập tay `NATIVE`) và bản chiếu
 * xe KGARA_SYNC từ V1 qua `CaseProjectorService`. Route `api/v2/cases-garage`, quyền `GARAGE`
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
      CaseServiceGarage,
    ]),
  ],
  // Controller ghi đứng trước để route tĩnh (`next-code`) không bị `GET :id` nuốt.
  controllers: [CasesGarageCommandsController, CasesGarageController],
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
    CaseKgaraMirrorService,
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
