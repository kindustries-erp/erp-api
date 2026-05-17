import { Body, Controller, Delete, Get, Post, Query } from '@nestjs/common';
import { SinvoiceService } from './sinvoice.service';
import { ViettelV2Service } from '../viettel-v2/viettel-v2.service';

@Controller('sinvoice')
export class SinvoiceController {
  constructor(
    private readonly sinvoiceService: SinvoiceService,
    private readonly viettelV2Service: ViettelV2Service
  ) {}

  @Get('health')
  async health() {
    return this.viettelV2Service.health();
  }

  @Get('local')
  async listLocal(@Query() query: any) {
    return this.viettelV2Service.listLocal(query);
  }

  @Get('local/draft')
  async listLocalDraft(@Query() query: any) {
    return this.viettelV2Service.listLocal({ ...query, status: 'DRAFT', source: 'SINVOICE', direction: 'OUT' });
  }

  @Get('local/issued')
  async listLocalIssued(@Query() query: any) {
    return this.viettelV2Service.listLocal({ ...query, status: 'ISSUED', source: 'SINVOICE', direction: 'OUT' });
  }

  @Get('sync-draft')
  async syncDraft(@Query() query: any) {
    return this.viettelV2Service.syncDraft(query);
  }

  @Get('sync-issued')
  async syncIssued(@Query() query: any) {
    return this.viettelV2Service.syncIssued(query);
  }

  @Post('create')
  async createDraft(@Body() body: any) {
    return this.viettelV2Service.createDraft(body);
  }

  @Get('sync')
  async getInvoices(@Query() query: any) {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const dto = {
      issueStartDate: query?.startDate ?? query?.issueStartDate ?? firstDayOfMonth.toISOString(),
      issueEndDate: query?.endDate ?? query?.issueEndDate ?? now.toISOString(),
      pageNum: query?.pageNum,
      rowPerPage: query?.rowPerPage,
    };
    const result = await this.viettelV2Service.syncInbound(dto);
    return {
      ...result,
      surface: 'SINVOICE',
      hiddenByDefault: false,
    };
  }

  @Get('config')
  async getConfig() {
    return this.sinvoiceService.getConfigEndpoint();
  }

  @Post('config')
  async saveConfig(@Body() body: any) {
    return this.sinvoiceService.saveConfig(body);
  }

  @Delete('config')
  async resetConfig() {
    return this.sinvoiceService.resetConfig();
  }

  @Get('tax-portal/config')
  async getTaxPortalConfig() {
    return this.sinvoiceService.getTaxPortalConfig();
  }

  @Post('tax-portal/config')
  async saveTaxPortalConfig(@Body() body: any) {
    return this.sinvoiceService.saveTaxPortalConfig(body);
  }

  @Delete('tax-portal/config')
  async resetTaxPortalConfig() {
    return this.sinvoiceService.resetTaxPortalConfig();
  }

  @Get('tax-portal/sync')
  async syncTaxPortal(@Query() query: any) {
    return this.sinvoiceService.syncTaxPortal(query);
  }

  @Post('demo-flow')
  async runSinvoiceDemoFlow() {
    return this.sinvoiceService.runSinvoiceDemoFlow();
  }
}
