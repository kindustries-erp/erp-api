import { Module } from '@nestjs/common';
import { PartnerLedgerSettlementsController } from './partner-ledger-settlements.controller';
import { PartnerLedgerSettlementsService } from './partner-ledger-settlements.service';

@Module({
  controllers: [PartnerLedgerSettlementsController],
  providers: [PartnerLedgerSettlementsService],
})
export class PartnerLedgerSettlementsModule {}
