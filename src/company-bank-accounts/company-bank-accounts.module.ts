import { Module } from '@nestjs/common';
import { CompanyBankAccountsController } from './company-bank-accounts.controller';
import { CompanyBankAccountsService } from './company-bank-accounts.service';

@Module({
  controllers: [CompanyBankAccountsController],
  providers: [CompanyBankAccountsService],
})
export class CompanyBankAccountsModule {}
