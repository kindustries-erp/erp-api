import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KgaraApiCoreModule } from '@/kgara-api-core/kgara-api-core.module';
import { DebtAllocationGarage } from './entities/debt-allocation-garage.entity';
import { DebtGarage } from './entities/debt-garage.entity';
import { DebtsLedgerController } from './controllers/debts-ledger.controller';
import { DebtLedgerQueryService } from './services/debt-ledger-query.service';
import { DebtPartyService } from './services/debt-party.service';
import { GarageDebtLedgerProjector } from './services/garage-debt-ledger.projector';
import { GarageDebtOriginService } from './services/garage-debt-origin.service';
import { GarageDebtSettlementService } from './services/garage-debt-settlement.service';
import { DebtsGarageController } from './controllers/debts-garage.controller';
import { DebtsExportController } from './controllers/debts-export.controller';
import { CustomerDebtQueryService } from './services/customer-debt-query.service';
import { DebtsAnalyticsService } from './services/debts-analytics.service';
import { DebtsExportJobsService } from './services/debts-export-jobs.service';
import { SupplierDebtQueryService } from './services/supplier-debt-query.service';
import { TimeHorizonCasesService } from './services/time-horizon-cases.service';

/**
 * Công nợ garage v2, xây trên lõi `debts-core`: lớp đọc từ `kgara_*`, sổ nợ `debts_garage`
 * (đọc, gán hãng, cài cổng settlement/origin, projector từ vụ việc). Việc ghi thu chi + phân bổ
 * đi qua orchestrator `debts-flow-garage`. Route `api/v2/debts-garage`, quyền `GARAGE_DEBTS`.
 */
@Module({
  imports: [
    KgaraApiCoreModule,
    TypeOrmModule.forFeature([DebtGarage, DebtAllocationGarage]),
  ],
  controllers: [
    DebtsGarageController,
    DebtsExportController,
    DebtsLedgerController,
  ],
  providers: [
    CustomerDebtQueryService,
    SupplierDebtQueryService,
    DebtsAnalyticsService,
    TimeHorizonCasesService,
    DebtsExportJobsService,
    DebtLedgerQueryService,
    DebtPartyService,
    GarageDebtOriginService,
    GarageDebtSettlementService,
    GarageDebtLedgerProjector,
  ],
  exports: [
    CustomerDebtQueryService,
    SupplierDebtQueryService,
    DebtsAnalyticsService,
    TimeHorizonCasesService,
    GarageDebtOriginService,
    GarageDebtSettlementService,
    GarageDebtLedgerProjector,
    DebtLedgerQueryService,
  ],
})
export class DebtsGarageModule {}
