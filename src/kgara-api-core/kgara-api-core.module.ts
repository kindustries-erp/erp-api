import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { KgaraAuth } from './entities/kgara_auth.entity';
import { KgaraBranch } from './entities/kgara_branch.entity';
import { KgaraCase } from './entities/kgara_case.entity';
import { KgaraReceivable } from './entities/kgara_receivable.entity';
import { KgaraPayable } from './entities/kgara_payable.entity';
import { KgaraCaseService } from './entities/kgara_case_service.entity';
import { GwSyncRun } from './entities/kgara_sync_run.entity';
import { KgaraCaseLinkedInvoice } from './entities/kgara_case_linked_invoice.entity';
import { KgaraGrossProfit } from './entities/kgara_gross_profit.entity';
import { KgaraCaseSettlement } from './entities/kgara_case_settlement.entity';
import { KgaraOperatingExpense } from './entities/kgara_operating_expense.entity';

import { CoreUser } from '../users/entities/core-user.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { CommonModule } from '../common/common.module';

import { KgaraAuthService } from './kgara-auth.service';
import { KgaraClientService } from './kgara-client.service';
import { KgaraSyncService } from './kgara-sync.service';
import { KgaraSyncScheduler } from './kgara-sync.scheduler';
import { GarageSmartSettlementService } from './services/garage-smart-settlement.service';
import { GarageOpexService } from './services/garage-opex.service';
import { GarageDashboardService } from './garage-dashboard.service';
import { KgaraCaseQueryService } from './services/kgara-case-query.service';
import { SyncRunLoggerService } from './services/sync-run-logger.service';
import { SyncDeletionService } from './services/sync-deletion.service';
import { SyncGrossProfitService } from './services/sync-gross-profit.service';
import { SyncDebtService } from './services/sync-debt.service';
import { SyncCaseService } from './services/sync-case.service';

import { KgaraApiCoreController } from './kgara-api-core.controller';
import { GarageDashboardController } from './garage-dashboard.controller';
import { KgaraCasesController } from './controllers/kgara-cases.controller';
import { KgaraCustomersController } from './controllers/kgara-customers.controller';
import { KgaraSuppliersController } from './controllers/kgara-suppliers.controller';
import { KgaraGrossProfitController } from './controllers/kgara-gross-profit.controller';
import { KgaraSyncController } from './controllers/kgara-sync.controller';
import { KgaraReportsController } from './controllers/kgara-reports.controller';
import { KgaraCaseFinancialController } from './controllers/kgara-case-financial.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      KgaraAuth,
      KgaraBranch,
      KgaraCase,
      KgaraReceivable,
      KgaraPayable,
      KgaraCaseService,
      GwSyncRun,
      KgaraCaseLinkedInvoice,
      KgaraGrossProfit,
      KgaraCaseSettlement,
      KgaraOperatingExpense,
      CoreUser,
    ]),
    ConfigModule,
    NotificationsModule,
    CommonModule,
  ],
  providers: [
    KgaraAuthService,
    KgaraClientService,
    KgaraSyncService,
    KgaraSyncScheduler,
    GarageSmartSettlementService,
    GarageOpexService,
    GarageDashboardService,
    KgaraCaseQueryService,
    SyncRunLoggerService,
    SyncDeletionService,
    SyncGrossProfitService,
    SyncDebtService,
    SyncCaseService,
  ],
  controllers: [
    KgaraApiCoreController,
    GarageDashboardController,
    KgaraCustomersController,
    KgaraSuppliersController,
    KgaraGrossProfitController,
    KgaraReportsController,
    KgaraSyncController,
    KgaraCaseFinancialController,
    KgaraCasesController,
  ],
  exports: [
    KgaraSyncService,
    KgaraClientService,
    GarageSmartSettlementService,
    GarageOpexService,
    GarageDashboardService,
    KgaraCaseQueryService,
    SyncRunLoggerService,
    SyncDeletionService,
    SyncGrossProfitService,
    SyncDebtService,
    SyncCaseService,
  ],
})
export class KgaraApiCoreModule {}
