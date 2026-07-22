import {
  Controller,
  Get,
  Query,
  Post,
  Patch,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
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

  @Get('journal-entries/:id')
  async getJournalEntryById(@Param('id') id: string) {
    const data = await this.accountingCoreService.getJournalEntryById(id);
    return { data };
  }

  @Get('chart-of-accounts')
  async getChartOfAccounts(@Query() query: any) {
    return this.accountingCoreService.getChartOfAccounts(query);
  }

  @Post('chart-of-accounts')
  async createChartOfAccount(@Body() dto: any) {
    const data = await this.accountingCoreService.createChartOfAccount(dto);
    return { message: 'Created', data };
  }

  @Patch('chart-of-accounts/:id')
  async updateChartOfAccount(@Param('id') id: string, @Body() dto: any) {
    const data = await this.accountingCoreService.updateChartOfAccount(id, dto);
    return { message: 'Updated', data };
  }

  @Delete('chart-of-accounts/:id')
  async deleteChartOfAccount(@Param('id') id: string) {
    await this.accountingCoreService.deleteChartOfAccount(id);
    return { message: 'Deleted' };
  }
}
