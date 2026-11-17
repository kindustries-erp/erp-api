import { Module } from '@nestjs/common';
import { KgaraApiCoreModule } from '@/kgara-api-core/kgara-api-core.module';
import { CashflowVouchersGarageModule } from '../cashflow-vouchers-garage/cashflow-vouchers-garage.module';
import { DebtsGarageModule } from '../debts-garage/debts-garage.module';
import { CashflowVoucherCommandsController } from './controllers/cashflow-voucher-commands.controller';
import { DebtAllocationsController } from './controllers/debt-allocations.controller';
import { GARAGE_LEDGER_PROJECTOR } from '@/kgara-api-core/hub/ledger-projector.port';
import { LegacyKgaraMirrorService } from './legacy/legacy-kgara-mirror.service';
import { LegacyAllocationSyncService } from './legacy/legacy-allocation-sync.service';
import { LegacyProjectorService } from './legacy/legacy-projector.service';
import { GarageDebtAllocationFlowService } from './services/garage-debt-allocation-flow.service';
import { GarageDebtsFlowEventsService } from './services/garage-debts-flow-events.service';
import { GarageDebtsFlowService } from './services/garage-debts-flow.service';
import { GarageVoucherAllocationService } from './services/garage-voucher-allocation.service';

/**
 * Orchestration thu chi + công nợ garage (mẫu `procurement-flow-garage`): ghi phiếu và phân bổ
 * trong MỘT transaction. Route ghi: `api/v2/cashflow-vouchers-garage` và `api/v2/debts-garage/allocations`.
 * Đăng ký vào `app.module.ts` ở task 2.6.1.
 */
@Module({
  imports: [
    KgaraApiCoreModule,
    CashflowVouchersGarageModule,
    DebtsGarageModule,
  ],
  controllers: [CashflowVoucherCommandsController, DebtAllocationsController],
  providers: [
    GarageDebtsFlowEventsService,
    GarageVoucherAllocationService,
    LegacyKgaraMirrorService,
    LegacyAllocationSyncService,
    LegacyProjectorService,
    { provide: GARAGE_LEDGER_PROJECTOR, useExisting: LegacyProjectorService },
    GarageDebtsFlowService,
    GarageDebtAllocationFlowService,
  ],
  exports: [GarageDebtsFlowService, GarageDebtAllocationFlowService],
})
export class DebtsFlowGarageModule {}
