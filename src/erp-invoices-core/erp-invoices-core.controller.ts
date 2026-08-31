import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  Sse,
  MessageEvent,
  UseGuards,
  UseInterceptors,
  Res,
  Request,
} from '@nestjs/common';
import type { Response } from 'express';
import { Observable } from 'rxjs';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../auth/guards/core-rbac.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { ErpResource, ErpAction } from '@/rbac-core/enums';
import { ErpInvoicesCoreService } from './erp-invoices-core.service';
import type {
  ErpInvoiceQuery,
  ErpInvoiceItemQuery,
} from './erp-invoices-core.service';
import { CreateErpInvoiceDto } from './dto/create-erp-invoice.dto';
import { UpdateErpInvoiceDto } from './dto/update-erp-invoice.dto';
import { PostInvoiceDto } from './dto/post-invoice.dto';
import { PortalFetchDto } from './dto/portal-invoice.dto';
import { PortalLoginDto } from './dto/portal-login.dto';

import { NotificationsService } from '../notifications/notifications.service';
import { DocumentTraceabilityService } from '../common/services/document-traceability.service';

@ApiTags('erp_invoices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('erp-invoices')
export class ErpInvoicesCoreController {
  constructor(
    private readonly service: ErpInvoicesCoreService,
    private readonly notificationsService: NotificationsService,
    private readonly traceabilityService: DocumentTraceabilityService,
  ) {}

  @RequirePermissions({
    resource: ErpResource.INVOICES,
    action: ErpAction.READ,
  })
  @Get(':id/traceability-graph')
  getTraceabilityGraph(@Param('id') id: string, @Request() req: any) {
    return this.traceabilityService.getInvoiceTraceabilityGraph(id, req.user);
  }

  // ---------------------------------------------------------------------------
  // CRUD cơ bản
  // ---------------------------------------------------------------------------

  @RequirePermissions({
    resource: ErpResource.INVOICES,
    action: ErpAction.READ,
  })
  @Get('items')
  @ApiQuery({ name: 'direction', required: false, enum: ['IN', 'OUT'] })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  findAllItems(@Query() query: ErpInvoiceItemQuery) {
    return this.service.findAllItems(query);
  }

  @RequirePermissions({
    resource: ErpResource.INVOICES,
    action: ErpAction.READ,
  })
  @Get('items/column-options')
  getItemColumnOptions(
    @Query('column') column: string,
    @Query('search') search: string,
    @Query('page') page: string,
    @Query('pageSize') pageSize: string,
    @Query('column_filters') filtersStr?: string,
    @Query('direction') direction?: 'IN' | 'OUT',
  ) {
    return this.service.getItemColumnOptions(
      column,
      search,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
      filtersStr,
      direction,
    );
  }

  @RequirePermissions({
    resource: ErpResource.INVOICES,
    action: ErpAction.READ,
  })
  @Get('items/export/excel')
  async exportItemsExcel(
    @Query() query: ErpInvoiceItemQuery,
    @Res() res: Response,
  ) {
    const buffer = await this.service.exportItemsExcel(query);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=invoice-lines-${query.direction || 'all'}.xlsx`,
    );
    res.send(buffer);
  }

  @RequirePermissions({
    resource: ErpResource.INVOICES,
    action: ErpAction.READ,
  })
  @Get()
  @ApiQuery({ name: 'direction', required: false, enum: ['IN', 'OUT'] })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'seller_name', required: false })
  @ApiQuery({ name: 'buyer_name', required: false })
  @ApiQuery({ name: 'date_from', required: false })
  @ApiQuery({ name: 'date_to', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'tag_id', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  findAll(@Query() query: ErpInvoiceQuery) {
    return this.service.findAll(query);
  }

  @RequirePermissions({
    resource: ErpResource.INVOICES,
    action: ErpAction.READ,
  })
  @Get('column-options')
  getColumnOptions(
    @Query('column') column: string,
    @Query('search') search: string,
    @Query('page') page: string,
    @Query('pageSize') pageSize: string,
    @Query('column_filters') filtersStr?: string,
    @Query('direction') direction?: 'IN' | 'OUT',
  ) {
    return this.service.getColumnOptions(
      column,
      search,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
      filtersStr,
      direction,
    );
  }

  @RequirePermissions({
    resource: ErpResource.INVOICES,
    action: ErpAction.READ,
  })
  @Get('export/excel')
  async exportExcel(@Query() query: ErpInvoiceQuery, @Res() res: Response) {
    const buffer = await this.service.exportExcel(query);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename=invoices.xlsx');
    res.send(buffer);
  }

  @RequirePermissions({
    resource: ErpResource.INVOICES,
    action: ErpAction.READ,
  })
  @Post('export/excel/background')
  startExportExcelBackground(
    @Body() query: ErpInvoiceQuery,
    @Request() req: any,
  ) {
    return this.service.startExportExcelBackground(query, req.user?.sub);
  }

  @RequirePermissions({
    resource: ErpResource.INVOICES,
    action: ErpAction.READ,
  })
  @Get('export/excel/background/history')
  getExportExcelBackgroundHistory(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.getExportExcelHistory(
      req.user?.sub,
      page ? Number(page) : undefined,
      pageSize ? Number(pageSize) : undefined,
    );
  }

  // Compatibility alias for clients using legacy path variant.
  @RequirePermissions({
    resource: ErpResource.INVOICES,
    action: ErpAction.READ,
  })
  @Post('export/background/excel')
  startExportExcelBackgroundAlias(
    @Body() query: ErpInvoiceQuery,
    @Request() req: any,
  ) {
    return this.service.startExportExcelBackground(query, req.user?.sub);
  }

  @RequirePermissions({
    resource: ErpResource.INVOICES,
    action: ErpAction.READ,
  })
  @Get('export/excel/background/:jobId/download')
  async downloadBackgroundExport(
    @Param('jobId') jobId: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    const { buffer, fileName } = this.service.getExportExcelBackgroundFile(
      jobId,
      req.user?.sub,
    );

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  }

  @Sse('export/excel/progress/stream')
  exportExcelProgressStream(@Request() req: any): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      subscriber.next({
        data: JSON.stringify({
          processId: 'ping',
          current: 0,
          total: 100,
          isRunning: false,
          completed: false,
          ready: false,
          failed: false,
          message: 'Connected',
        }),
      } as MessageEvent);

      const snapshot = this.service.getExportExcelProgressSnapshot(
        req.user?.sub,
      );
      if (snapshot) {
        subscriber.next({ data: JSON.stringify(snapshot) } as MessageEvent);
      }

      const intervalId = setInterval(() => {
        subscriber.next({
          data: JSON.stringify({
            processId: 'ping',
            current: 0,
            total: 100,
            isRunning: false,
            completed: false,
            ready: false,
            failed: false,
            message: 'Ping',
          }),
        } as MessageEvent);
      }, 15000);

      const subscription = this.service.exportProgress$.subscribe({
        next: (data) => {
          if (data.userId !== req.user?.sub) return;
          subscriber.next({ data: JSON.stringify(data) } as MessageEvent);
        },
        error: (err) => subscriber.error(err),
        complete: () => subscriber.complete(),
      });

      return () => {
        clearInterval(intervalId);
        subscription.unsubscribe();
      };
    });
  }

  @RequirePermissions({
    resource: ErpResource.INVOICES,
    action: ErpAction.READ,
  })
  @Get('stats')
  @ApiQuery({ name: 'direction', required: false, enum: ['IN', 'OUT'] })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  getStats(
    @Query('direction') direction?: 'IN' | 'OUT',
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.service.getStats(direction, dateFrom, dateTo);
  }

  @RequirePermissions({
    resource: ErpResource.INVOICES,
    action: ErpAction.READ,
  })
  @Post('bulk-net-offs')
  getBulkNetOffs(@Body('ids') ids: string[]) {
    return this.service.getBulkNetOffs(ids);
  }

  @RequirePermissions({
    resource: ErpResource.INVOICES,
    action: ErpAction.READ,
  })
  @Post('smart-net-off-suggestions')
  getSmartNetOffSuggestions(@Body('invoiceIds') invoiceIds: string[]) {
    return this.service.getSmartNetOffSuggestions(invoiceIds);
  }

  @RequirePermissions({
    resource: ErpResource.INVOICES,
    action: ErpAction.CREATE,
  })
  @Post()
  create(@Body() dto: CreateErpInvoiceDto) {
    return this.service.create(dto);
  }

  @RequirePermissions({
    resource: ErpResource.INVOICES,
    action: ErpAction.READ,
  })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @RequirePermissions({
    resource: ErpResource.INVOICES,
    action: ErpAction.UPDATE,
  })
  @Post(':id/post')
  postInvoice(@Param('id') id: string, @Body() dto: PostInvoiceDto) {
    return this.service.postInvoice(id, dto);
  }

  @RequirePermissions({
    resource: ErpResource.INVOICES,
    action: ErpAction.UPDATE,
  })
  @Post(':id/unpost')
  unpostInvoice(@Param('id') id: string) {
    return this.service.unpostInvoice(id);
  }

  @RequirePermissions({
    resource: ErpResource.INVOICES,
    action: ErpAction.UPDATE,
  })
  @Post(':id/auto-post-standard')
  autoPostStandard(@Param('id') id: string) {
    return this.service.autoPostStandard(id);
  }

  @RequirePermissions({
    resource: ErpResource.INVOICES,
    action: ErpAction.UPDATE,
  })
  @Patch('bulk-set-branch')
  bulkSetBranch(@Body() body: { ids: string[]; branchId: string | null }) {
    return this.service.bulkSetBranch(body.ids, body.branchId);
  }

  @RequirePermissions({
    resource: ErpResource.INVOICES,
    action: ErpAction.UPDATE,
  })
  @Patch('bulk-set-notes')
  bulkSetNotes(@Body() body: { ids: string[]; notes: string }) {
    return this.service.bulkSetNotes(body.ids, body.notes);
  }

  @RequirePermissions({
    resource: ErpResource.INVOICES,
    action: ErpAction.UPDATE,
  })
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateErpInvoiceDto) {
    return this.service.update(id, dto);
  }

  @RequirePermissions({
    resource: ErpResource.INVOICES,
    action: ErpAction.DELETE,
  })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @RequirePermissions({
    resource: ErpResource.INVOICES,
    action: ErpAction.UPDATE,
  })
  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.service.cancel(id);
  }

  @Post(':id/sync-detail')
  syncDetail(@Param('id') id: string, @Body('token') token?: string) {
    return this.service.syncDetailFromPortal(id, token);
  }

  @RequirePermissions({
    resource: ErpResource.INVOICES,
    action: ErpAction.UPDATE,
  })
  @Post(':id/net-off-vouchers')
  linkVouchers(
    @Param('id') id: string,
    @Body() payload: { bankTransactionId: string; netOffAmount?: number }[],
  ) {
    return this.service.linkVouchersToInvoice(id, payload);
  }

  @RequirePermissions({
    resource: ErpResource.INVOICES,
    action: ErpAction.UPDATE,
  })
  @Delete(':id/net-off-vouchers/:voucherId')
  removeVoucherLink(
    @Param('id') id: string,
    @Param('voucherId') voucherId: string,
  ) {
    return this.service.removeVoucherFromInvoice(id, voucherId);
  }

  /**
   * POST /api/v1/erp-invoices/portal/sync
   * Fetch từ GDT portal, lưu vào DB, download XML theo batch rate-limited.
   */
  @RequirePermissions({
    resource: ErpResource.INVOICES,
    action: ErpAction.UPDATE,
  })
  @Post('portal/sync')
  async syncPortal(@Body() dto: PortalFetchDto, @Request() req: any) {
    try {
      return await this.service.syncFromPortal(dto, req.user?.sub);
    } catch (e: any) {
      const message = e?.response?.message ?? e?.message;
      if (message === 'GDT_TOKEN_EXPIRED') {
        if (req.user?.sub) {
          await this.notificationsService.createForUser(req.user.sub, {
            type: 'ERROR',
            title: 'Token GDT hết hạn',
            message:
              'Vui lòng đăng nhập lại tại hoadondientu.gdt.gov.vn và cập nhật token trong hệ thống.',
          });
        }
        throw new BadRequestException('GDT_TOKEN_EXPIRED');
      }
      if (
        message === 'GDT_TAXPAYER_MISMATCH' ||
        message === 'GDT_COMPANY_TAX_CODE_NOT_CONFIGURED' ||
        message === 'GDT_PROFILE_FETCH_FAILED' ||
        message === 'GDT_PROFILE_MISSING_TAX_CODE'
      ) {
        if (req.user?.sub) {
          await this.notificationsService.createForUser(req.user.sub, {
            type: 'ERROR',
            title: 'Không thể đồng bộ hóa đơn từ GDT',
            message:
              message === 'GDT_TAXPAYER_MISMATCH'
                ? 'Token GDT không khớp mã số thuế công ty đang cấu hình trong hệ thống.'
                : 'Xác thực hồ sơ người nộp thuế thất bại. Vui lòng kiểm tra cấu hình token/cookie và MST công ty.',
          });
        }
        throw new BadRequestException(message);
      }
      throw e;
    }
  }

  @RequirePermissions({
    resource: ErpResource.INVOICES,
    action: ErpAction.UPDATE,
  })
  @Patch(':id/validate')
  async validateInvoice(
    @Param('id') id: string,
    @Body() body: { isValid: boolean },
    @Request() req: any,
  ) {
    await this.service.setInvoiceValid(id, body.isValid, req.user?.sub);
    return { success: true };
  }

  /**
   * POST /api/v1/erp-invoices/portal/bulk-download-xml
   * Tải lại XML cho tất cả hóa đơn chưa có XML trong DB
   */
  @RequirePermissions({
    resource: ErpResource.INVOICES,
    action: ErpAction.UPDATE,
  })
  @Post('portal/bulk-download-xml')
  bulkDownloadXml(
    @Body() body: { token?: string; cookies?: string; direction: 'IN' | 'OUT' },
  ) {
    return this.service.bulkDownloadXml(
      body.token,
      body.cookies,
      body.direction,
    );
  }

  @RequirePermissions({
    resource: ErpResource.INVOICES,
    action: ErpAction.UPDATE,
  })
  @Get('portal/captcha')
  async getPortalCaptcha() {
    return await this.service.getPortalCaptcha();
  }

  @RequirePermissions({
    resource: ErpResource.INVOICES,
    action: ErpAction.UPDATE,
  })
  @Post('portal/login')
  async loginPortal(@Body() dto: PortalLoginDto) {
    return await this.service.loginPortalWithCaptcha(dto);
  }

  @RequirePermissions({
    resource: ErpResource.INVOICES,
    action: ErpAction.UPDATE,
  })
  @Get('portal/token')
  async getPortalToken() {
    return await this.service.getPortalConfig();
  }

  @RequirePermissions({
    resource: ErpResource.INVOICES,
    action: ErpAction.UPDATE,
  })
  @Post('portal/token')
  async savePortalToken(
    @Body()
    body: {
      token: string;
      cookies?: string;
      username?: string;
      password?: string;
    },
  ) {
    await this.service.savePortalConfig(
      body.token,
      body.cookies,
      body.username,
      body.password,
    );
    return { message: 'Config saved successfully' };
  }

  // ---------------------------------------------------------------------------
  // Bulk XML import
  // ---------------------------------------------------------------------------

  /**
   * POST /api/v1/erp-invoices/preview-pdf-match
   * Lấy trước thông tin hóa đơn sẽ ghép cho các file PDF mồ côi
   */
  @Post('preview-pdf-match')
  async previewPdfMatch(
    @Body() body: { filenames: string[]; direction: 'IN' | 'OUT' },
  ) {
    if (!body.filenames || !Array.isArray(body.filenames)) {
      throw new BadRequestException(
        'filenames is required and must be an array',
      );
    }
    return this.service.previewPdfMatch(body.filenames, body.direction || 'IN');
  }

  /**
   * POST /api/v1/erp-invoices/bulk-import-xml/buyer
   * Import hàng loạt XML hóa đơn đầu vào (direction = IN)
   */
  @Post('bulk-import-xml/buyer')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FilesInterceptor('files', 200, {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB/file
      fileFilter: (_req, file, cb) => {
        const ok =
          file.originalname.toLowerCase().endsWith('.xml') ||
          file.originalname.toLowerCase().endsWith('.pdf') ||
          file.originalname.toLowerCase().endsWith('.zip') ||
          [
            'application/xml',
            'text/xml',
            'application/pdf',
            'application/zip',
            'application/x-zip-compressed',
          ].includes(file.mimetype);
        if (!ok) {
          cb(
            new BadRequestException(
              `File "${file.originalname}" không được hỗ trợ (chỉ nhận .xml, .pdf, .zip)`,
            ),
            false,
          );
        } else {
          cb(null, true);
        }
      },
    }),
  )
  async bulkImportBuyer(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Chưa chọn file nào');
    }
    return this.service.bulkImportMixed(
      files.map((f) => ({
        filename: f.originalname,
        buffer: f.buffer,
        mimetype: f.mimetype,
      })),
      'IN',
    );
  }

  /**
   * POST /api/v1/erp-invoices/bulk-import-xml/seller
   * Import hàng loạt XML hóa đơn đầu ra (direction = OUT)
   */
  @Post('bulk-import-xml/seller')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FilesInterceptor('files', 200, {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ok =
          file.originalname.toLowerCase().endsWith('.xml') ||
          file.originalname.toLowerCase().endsWith('.pdf') ||
          file.originalname.toLowerCase().endsWith('.zip') ||
          [
            'application/xml',
            'text/xml',
            'application/pdf',
            'application/zip',
            'application/x-zip-compressed',
          ].includes(file.mimetype);
        if (!ok) {
          cb(
            new BadRequestException(
              `File "${file.originalname}" không được hỗ trợ (chỉ nhận .xml, .pdf, .zip)`,
            ),
            false,
          );
        } else {
          cb(null, true);
        }
      },
    }),
  )
  async bulkImportSeller(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Chưa chọn file nào');
    }
    return this.service.bulkImportMixed(
      files.map((f) => ({
        filename: f.originalname,
        buffer: f.buffer,
        mimetype: f.mimetype,
      })),
      'OUT',
    );
  }

  // ---------------------------------------------------------------------------
  // Pre-signed URLs
  // ---------------------------------------------------------------------------

  /**
   * GET /api/v1/erp-invoices/:id/download-url?type=pdf|xml
   */
  @Get(':id/download-url')
  @ApiQuery({ name: 'type', required: true, enum: ['pdf', 'xml'] })
  getDownloadUrl(@Param('id') id: string, @Query('type') type: 'pdf' | 'xml') {
    if (!['pdf', 'xml'].includes(type)) {
      throw new BadRequestException('type phải là pdf hoặc xml');
    }
    return this.service.getFileDownloadUrl(id, type);
  }

  /**
   * POST /api/v1/erp-invoices/:id/upload-url
   * Body: { fileType: 'pdf' | 'xml' }
   */
  @Post(':id/upload-url')
  getUploadUrl(
    @Param('id') id: string,
    @Body() body: { fileType: 'pdf' | 'xml' },
  ) {
    if (!['pdf', 'xml'].includes(body.fileType)) {
      throw new BadRequestException('fileType phải là pdf hoặc xml');
    }
    return this.service.getFileUploadUrl(id, body.fileType);
  }

  /**
   * POST /api/v1/erp-invoices/:id/pdfs
   */
  @Post(':id/pdfs')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FilesInterceptor('files', 20, {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ok =
          file.originalname.toLowerCase().endsWith('.pdf') ||
          file.mimetype === 'application/pdf';
        if (!ok) {
          cb(
            new BadRequestException(
              `File "${file.originalname}" không phải PDF`,
            ),
            false,
          );
        } else {
          cb(null, true);
        }
      },
    }),
  )
  uploadPdfs(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body('documentType') documentType?: string,
    @Request() req?: any,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Chưa chọn file PDF nào');
    }
    return this.service.uploadPdfs(
      id,
      files.map((f) => ({
        filename: f.originalname,
        buffer: f.buffer,
        mimetype: f.mimetype,
      })),
      documentType,
      req?.user?.sub,
    );
  }

  @RequirePermissions({
    resource: ErpResource.INVOICES,
    action: ErpAction.UPDATE,
  })
  @Post(':id/attachments/link')
  linkAttachment(
    @Param('id') id: string,
    @Body() body: { attachmentId: string },
  ) {
    return this.service.linkAttachment(id, body.attachmentId);
  }

  @RequirePermissions({
    resource: ErpResource.INVOICES,
    action: ErpAction.UPDATE,
  })
  @Delete(':id/attachments/:attachmentId')
  unlinkAttachment(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    return this.service.unlinkAttachment(id, attachmentId);
  }

  @Get(':id/pdfs/zip')
  async getPdfZip(@Param('id') id: string, @Res() res: any) {
    const buffer = await this.service.downloadAllPdfsZip(id);
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="invoices_${id}.zip"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }

  @Post('bulk-download-files')
  async bulkDownloadFiles(
    @Body() payload: { query: ErpInvoiceQuery; types: string[] },
    @Res() res: Response,
  ) {
    if (!payload.types || payload.types.length === 0) {
      throw new BadRequestException(
        'Vui lòng chọn ít nhất 1 loại file (pdf, xml)',
      );
    }
    const monthStr = payload.query?.date_from?.substring(0, 7) || 'All';
    const directionStr = payload.query?.direction || 'IN_OUT';

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="HoaDon_${monthStr}_${directionStr}.zip"`,
    );

    return this.service.bulkDownloadFilesZip(payload, res);
  }

  @Post('bulk-download-selected')
  async bulkDownloadSelected(
    @Body() payload: { ids: string[]; types: string[] },
    @Res() res: Response,
  ) {
    if (!payload.types || payload.types.length === 0) {
      throw new BadRequestException(
        'Vui lòng chọn ít nhất 1 loại file (pdf, xml)',
      );
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="HoaDon_Selected_${Date.now()}.zip"`,
    );

    return this.service.bulkDownloadSelectedZip(payload, res);
  }

  @Get(':id/pdfs/:key/content')
  async getPdfContent(
    @Param('id') id: string,
    @Param('key') key: string,
    @Res() res: any,
  ) {
    const buffer = await this.service.getPdfContent(
      id,
      decodeURIComponent(key),
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline',
      'Content-Length': buffer.length,
      'Cache-Control': 'private, max-age=300',
    });
    res.send(buffer);
  }

  @Get(':id/pdfs/:key/download-url')
  getPdfDownloadUrl(
    @Param('id') id: string,
    @Param('key') key: string,
    @Query('inline') inline?: string,
  ) {
    return this.service.getPdfDownloadUrl(
      id,
      decodeURIComponent(key),
      inline === 'true',
    );
  }

  @Delete(':id/pdfs/:key')
  deletePdf(@Param('id') id: string, @Param('key') key: string) {
    return this.service.deletePdf(id, decodeURIComponent(key));
  }

  // ---------------------------------------------------------------------------
  // Server-Sent Events (SSE)
  // ---------------------------------------------------------------------------

  @Sse('portal/progress')
  progress(): Observable<MessageEvent> {
    const keepAlive$ = new Observable<MessageEvent>((subscriber) => {
      // Emit initial event to force 200 OK and establish connection
      subscriber.next({
        data: JSON.stringify({
          message: 'Connected',
          processId: 'ping',
          current: 0,
          total: 0,
          completed: false,
        }),
      } as MessageEvent);

      const intervalId = setInterval(() => {
        subscriber.next({
          data: JSON.stringify({
            message: 'Ping',
            processId: 'ping',
            current: 0,
            total: 0,
            completed: false,
          }),
        } as MessageEvent);
      }, 15000); // 15s keep-alive

      const subscription = this.service.progress$.subscribe({
        next: (data) =>
          subscriber.next({ data: JSON.stringify(data) } as MessageEvent),
        error: (err) => subscriber.error(err),
        complete: () => subscriber.complete(),
      });

      return () => {
        clearInterval(intervalId);
        subscription.unsubscribe();
      };
    });

    return keepAlive$;
  }
}
