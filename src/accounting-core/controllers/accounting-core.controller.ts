import { Controller, Get, Query } from '@nestjs/common';
import { AccountingCoreService } from '../services/accounting-core.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('AccountingCore')
@Controller({
  path: 'accounting-core',
  version: '1',
})
export class AccountingCoreController {
  constructor(private readonly accountingCoreService: AccountingCoreService) {}

  @Get('journal-entries')
  async getJournalEntries(@Query() query: any) {
    return this.accountingCoreService.getJournalEntries(query);
  }

  @Get('chart-of-accounts')
  async getChartOfAccounts(@Query() query: any) {
    return this.accountingCoreService.getChartOfAccounts(query);
  }
}
