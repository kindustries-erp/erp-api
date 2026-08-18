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

import { CoreUser } from '../users/entities/core-user.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { CommonModule } from '../common/common.module';

import { KgaraAuthService } from './kgara-auth.service';
import { KgaraClientService } from './kgara-client.service';
import { KgaraSyncService } from './kgara-sync.service';
import { KgaraSyncScheduler } from './kgara-sync.scheduler';
import { KgaraApiCoreController } from './kgara-api-core.controller';

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
  ],
  controllers: [KgaraApiCoreController],
  exports: [KgaraSyncService, KgaraClientService],
})
export class KgaraApiCoreModule {}
