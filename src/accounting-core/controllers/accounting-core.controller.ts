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

  @Get('chart-of-accounts/column-options')
  async getChartOfAccountsColumnOptions(
    @Query('column') column: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('filters') filters?: string,
  ) {
    return this.accountingCoreService.getChartOfAccountsColumnOptions(
      column,
      search,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
      filters,
    );
  }

  @Get('chart-of-accounts/:id')
  async getChartOfAccountById(@Param('id') id: string) {
    const data = await this.accountingCoreService.getChartOfAccountById(id);
    return { data };
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
