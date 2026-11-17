import { Module } from '@nestjs/common';
import { KgaraApiCoreModule } from '@/kgara-api-core/kgara-api-core.module';
import { DebtsGarageController } from './controllers/debts-garage.controller';
import { DebtsExportController } from './controllers/debts-export.controller';
import { CustomerDebtQueryService } from './services/customer-debt-query.service';
import { DebtsAnalyticsService } from './services/debts-analytics.service';
import { DebtsExportJobsService } from './services/debts-export-jobs.service';
import { SupplierDebtQueryService } from './services/supplier-debt-query.service';
import { TimeHorizonCasesService } from './services/time-horizon-cases.service';

/**
 * Công nợ garage v2, xây trên lõi `debts-core` (chỉ đọc ở plan này).
 * Route `api/v2/debts-garage`, quyền `GARAGE_DEBTS:READ`.
 * Đăng ký vào `app.module.ts` ở task 2.4.1.
 */
@Module({
  imports: [KgaraApiCoreModule],
  controllers: [DebtsGarageController, DebtsExportController],
  providers: [
    CustomerDebtQueryService,
    SupplierDebtQueryService,
    DebtsAnalyticsService,
    TimeHorizonCasesService,
    DebtsExportJobsService,
  ],
  exports: [
    CustomerDebtQueryService,
    SupplierDebtQueryService,
    DebtsAnalyticsService,
    TimeHorizonCasesService,
  ],
})
export class DebtsGarageModule {}
