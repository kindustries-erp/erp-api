import { Module } from '@nestjs/common';
import { PartnerLedgerItemsController } from './partner-ledger-items.controller';
import { PartnerLedgerItemsService } from './partner-ledger-items.service';

@Module({
  controllers: [PartnerLedgerItemsController],
  providers: [PartnerLedgerItemsService],
})
export class PartnerLedgerItemsModule {}
