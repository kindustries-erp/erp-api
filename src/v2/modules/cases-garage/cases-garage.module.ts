import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KgaraBranch } from '@/kgara-api-core/entities/kgara_branch.entity';
import { KgaraCase } from '@/kgara-api-core/entities/kgara_case.entity';
import { KgaraCaseLinkedInvoice } from '@/kgara-api-core/entities/kgara_case_linked_invoice.entity';
import { KgaraCaseService } from '@/kgara-api-core/entities/kgara_case_service.entity';
import { KgaraCaseSettlement } from '@/kgara-api-core/entities/kgara_case_settlement.entity';
import { KgaraGrossProfit } from '@/kgara-api-core/entities/kgara_gross_profit.entity';
import { CasesGarageController } from './controllers/cases-garage.controller';
import { CaseColumnOptionsService } from './services/case-column-options.service';
import { CaseDetailQueryService } from './services/case-detail-query.service';
import { CaseServicesQueryService } from './services/case-services-query.service';
import { CaseListEnrichmentService } from './services/case-list-enrichment.service';
import { CaseListQueryService } from './services/case-list-query.service';
import { GrossProfitReportService } from './services/gross-profit-report.service';

/**
 * Vụ việc Kgara v2 (chỉ đọc), dùng lại bảng `kgara_*`; không entity mới, không command service.
 * Route `api/v2/cases-garage`, quyền `GARAGE:READ`. Đăng ký `app.module.ts` ở task 2.4.1.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      KgaraCase,
      KgaraGrossProfit,
      KgaraCaseSettlement,
      KgaraCaseLinkedInvoice,
      KgaraCaseService,
      KgaraBranch,
    ]),
  ],
  controllers: [CasesGarageController],
  providers: [
    CaseListEnrichmentService,
    CaseListQueryService,
    CaseColumnOptionsService,
    CaseDetailQueryService,
    GrossProfitReportService,
    CaseServicesQueryService,
  ],
  exports: [
    CaseListQueryService,
    CaseColumnOptionsService,
    CaseDetailQueryService,
    GrossProfitReportService,
    CaseServicesQueryService,
  ],
})
export class CasesGarageModule {}
