import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { SinvoiceService } from './sinvoice.service';

@Controller('sinvoice')
export class SinvoiceController {
  constructor(private readonly sinvoiceService: SinvoiceService) {}

  @Get('health')
  async health() {
    return this.sinvoiceService.health();
  }

  @Get('local')
  async listLocalInvoices() {
    return this.sinvoiceService.listLocalInvoices();
  }

  @Post('create')
  async createInvoice(@Body() body: any) {
    return this.sinvoiceService.createInvoice(body);
  }

  @Post('cancel')
  async cancelInvoice(@Body() body: any) {
    return this.sinvoiceService.cancelInvoice(body);
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

  @Post('demo-flow')
  async fullDemoFlow() {
    return this.sinvoiceService.fullDemoFlow();
  }
}
