import { Body, Controller, Delete, Get, Post, Query } from '@nestjs/common';
import { SinvoiceService } from './sinvoice.service';
import { ViettelV2Service } from '../viettel-v2/viettel-v2.service';
import { CreateViettelV2DraftDto, SyncViettelV2InboundDto } from '../viettel-v2/dto/viettel-v2.dto';

@Controller('sinvoice')
export class SinvoiceController {
  constructor(
    private readonly sinvoiceService: SinvoiceService,
    private readonly viettelV2Service: ViettelV2Service,
  ) {}

  @Get('health')
  async health() {
    const health = await this.viettelV2Service.health();
    return {
      ...health,
      surface: 'SINVOICE',
      legacyMode: 'COMMENT_ONLY',
      hiddenByDefault: false,
    };
  }

  @Get('local')
  async listLocalInvoices(@Query() query: any) {
    const result = await this.viettelV2Service.listLocal(query);
    return {
      ...result,
      hiddenByDefault: false,
      surface: 'SINVOICE',
    };
  }

  @Post('create')
  async createInvoice(@Body() body: CreateViettelV2DraftDto) {
    const result = await this.viettelV2Service.createDraft(body);
    return {
      ...result,
      surface: 'SINVOICE',
    };
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
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const dto: SyncViettelV2InboundDto = {
      supplierTaxCode: query?.supplierTaxCode,
      issueStartDate: query?.startDate ?? query?.issueStartDate ?? firstDayOfMonth.toISOString(),
      issueEndDate: query?.endDate ?? query?.issueEndDate ?? now.toISOString(),
      pageNum: query?.pageNum,
      rowPerPage: query?.rowPerPage,
      inputSource: query?.inputSource,
      validatedStatus: query?.validatedStatus,
      invoiceStatus: query?.invoiceStatus,
      searchText: query?.searchText ?? query?.search,
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
    const dto: TaxPortalSyncQueryDto = {
      direction: query?.direction ?? 'IN',
      startDate: query?.startDate,
      endDate: query?.endDate,
      pageSize: query?.pageSize ? Number(query.pageSize) : undefined,
      size: query?.size ? Number(query.size) : undefined,
    };
    return this.sinvoiceService.syncTaxPortal(dto);
  }

  @Post('demo-flow')
  async fullDemoFlow() {
    return this.sinvoiceService.fullDemoFlow();
  }
}
