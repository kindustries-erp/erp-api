import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { SinvoiceService } from './sinvoice.service';
import {
  CreateSinvoiceDraftDto,
  ListSinvoiceDraftQueryDto,
  SaveSinvoiceConfigDto,
} from './dto/sinvoice-draft.dto';
import { TaxPortalSyncQueryDto } from './dto/sinvoice.dto';

@Controller('sinvoice')
export class SinvoiceController {
  constructor(private readonly sinvoiceService: SinvoiceService) {}

  // ─────────────────────── HEALTH ────────────────────────────────────────
  @Get('health')
  async health() {
    return this.sinvoiceService.health();
  }

  // ─────────────────────── CONFIG ────────────────────────────────────────
  @Get('config')
  async getConfig() {
    return this.sinvoiceService.getConfigEndpoint();
  }

  @Post('config')
  async saveConfig(@Body() body: SaveSinvoiceConfigDto) {
    return this.sinvoiceService.saveConfig(body);
  }

  @Delete('config')
  async resetConfig() {
    return this.sinvoiceService.resetConfig();
  }

  // ─────────────────────── SINVOICE DRAFTS ───────────────────────────────
  @Get('draft/column-options')
  getColumnOptions(
    @Query('column') column: string,
    @Query('search') search: string,
    @Query('page') page: string,
    @Query('pageSize') pageSize: string,
    @Query('column_filters') filtersStr?: string,
  ) {
    return this.sinvoiceService.getDraftColumnOptions(
      column,
      search,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
      filtersStr,
    );
  }

  @Get('draft')
  async listDrafts(@Query() query: ListSinvoiceDraftQueryDto) {
    return this.sinvoiceService.listDrafts(query);
  }

  @Post('draft')
  async createDraft(@Body() body: CreateSinvoiceDraftDto) {
    return this.sinvoiceService.createDraft(body);
  }

  @Delete('draft/:id')
  async deleteDraft(@Param('id') id: string) {
    return this.sinvoiceService.deleteDraft(id);
  }

  @Post('draft/sync')
  async syncDraftsFromViettel() {
    return this.sinvoiceService.syncDraftsFromViettel();
  }

  // ─────────────────────── CANCEL / DOWNLOAD ─────────────────────────────
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

  @Post('demo-flow')
  async fullDemoFlow() {
    return this.sinvoiceService.fullDemoFlow();
  }

  // ─────────────────────── TAX PORTAL ────────────────────────────────────
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
    const dto: TaxPortalSyncQueryDto = {
      direction: query?.direction ?? 'IN',
      startDate: query?.startDate,
      endDate: query?.endDate,
      pageSize: query?.pageSize ? Number(query.pageSize) : undefined,
      size: query?.size ? Number(query.size) : undefined,
    };
    return this.sinvoiceService.syncTaxPortal(dto);
  }
}
