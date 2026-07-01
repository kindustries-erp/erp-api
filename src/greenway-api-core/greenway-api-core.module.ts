import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { GreenwayAuth } from './entities/gw_auth.entity';
import { GreenwayBranch } from './entities/gw_branch.entity';
import { GreenwayCase } from './entities/gw_case.entity';
import { GreenwayReceivable } from './entities/gw_receivable.entity';
import { GreenwayPayable } from './entities/gw_payable.entity';
import { GreenwayCaseService } from './entities/gw_case_service.entity';
import { GreenwayCasePayment } from './entities/gw_case_payment.entity';

import { GreenwayAuthService } from './greenway-auth.service';
import { GreenwayClientService } from './greenway-client.service';
import { GreenwaySyncService } from './greenway-sync.service';
import { GreenwayApiCoreController } from './greenway-api-core.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GreenwayAuth,
      GreenwayBranch,
      GreenwayCase,
      GreenwayReceivable,
      GreenwayPayable,
      GreenwayCaseService,
      GreenwayCasePayment,
    ]),
    ConfigModule,
  ],
  providers: [GreenwayAuthService, GreenwayClientService, GreenwaySyncService],
  controllers: [GreenwayApiCoreController],
  exports: [GreenwaySyncService, GreenwayClientService],
})
export class GreenwayApiCoreModule {}
