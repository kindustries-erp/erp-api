import { Module } from '@nestjs/common';
import { BusinessPartnerBankAccountsController } from './business-partner-bank-accounts.controller';
import { BusinessPartnerBankAccountsService } from './business-partner-bank-accounts.service';

@Module({
  controllers: [BusinessPartnerBankAccountsController],
  providers: [BusinessPartnerBankAccountsService],
})
export class BusinessPartnerBankAccountsModule {}
