import { Body, Controller, Delete, Get, Post, Query } from '@nestjs/common';
import { SinvoiceService } from './sinvoice.service';

@Controller('sinvoice')
export class SinvoiceController {
  constructor(private readonly sinvoiceService: SinvoiceService) {}

  @Get('health')
  async health() {
    return this.sinvoiceService.health();
  }

  @Get('local')
  async listLocalInvoices(@Query() query: any) {
    return this.sinvoiceService.listLocalInvoices(query);
  }

  @Post('create')
  async createInvoice(@Body() body: any) {
    return this.sinvoiceService.createInvoice(body);
  }

  @Post('cancel')
  async cancelInvoice(@Body() _body: any) {
    return this.sinvoiceService.cancelInvoice();
  }

  @Get('download')
  async downloadInvoice(
    @Query('invoiceNo') invoiceNo: string,
    @Query('pattern') pattern: string,
    @Query('fileType') fileType: 'PDF' | 'XML' | 'ZIP',
  ) {
    return this.sinvoiceService.getInvoiceFile(invoiceNo, pattern, fileType);
  }

  @Get('sync')
  async getInvoices(@Query() query: any) {
    return this.sinvoiceService.getInvoices(query);
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
  async fullDemoFlow() {
    return this.sinvoiceService.fullDemoFlow();
  }
}
