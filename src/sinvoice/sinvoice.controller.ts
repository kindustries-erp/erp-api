import { Controller, Post, Body, Get, Query, UseGuards } from '@nestjs/common';
import { SinvoiceService } from './sinvoice.service';

@Controller('sinvoice')
export class SinvoiceController {
  constructor(private readonly sinvoiceService: SinvoiceService) {}

  @Post('create')
  async createInvoice(@Body() body: any) {
    return this.sinvoiceService.createInvoice(body);
  }

  @Get('download')
  async downloadInvoice(
    @Query('invoiceNo') invoiceNo: string,
    @Query('pattern') pattern: string,
    @Query('fileType') fileType: 'PDF' | 'XML' | 'ZIP',
  ) {
    return this.sinvoiceService.getInvoiceFile(invoiceNo, pattern, fileType);
  }
}
