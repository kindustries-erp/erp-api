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
} from '@nestjs/common';
import type { Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../auth/guards/core-rbac.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { ErpInvoicesCoreService } from './erp-invoices-core.service';
import type { ErpInvoiceQuery } from './erp-invoices-core.service';
import { CreateErpInvoiceDto } from './dto/create-erp-invoice.dto';
import { UpdateErpInvoiceDto } from './dto/update-erp-invoice.dto';
import { PortalFetchDto } from './dto/portal-invoice.dto';

@ApiTags('erp_invoices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('erp-invoices')
export class ErpInvoicesCoreController {
  constructor(private readonly service: ErpInvoicesCoreService) {}

  // ---------------------------------------------------------------------------
  // CRUD cơ bản
  // ---------------------------------------------------------------------------

  @RequirePermissions({ resource: 'invoices', action: 'read' })
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

  @RequirePermissions({ resource: 'invoices', action: 'read' })
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

  @RequirePermissions({ resource: 'invoices', action: 'create' })
  @Post()
  create(@Body() dto: CreateErpInvoiceDto) {
    return this.service.create(dto);
  }

  @RequirePermissions({ resource: 'invoices', action: 'read' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @RequirePermissions({ resource: 'invoices', action: 'update' })
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateErpInvoiceDto) {
    return this.service.update(id, dto);
  }

  @RequirePermissions({ resource: 'invoices', action: 'delete' })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @RequirePermissions({ resource: 'invoices', action: 'update' })
  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.service.cancel(id);
  }

  @Post(':id/reparse-xml')
  reparseXml(@Param('id') id: string, @Body('token') token?: string) {
    return this.service.reparseXml(id, token);
  }

  @Post(':id/sync-detail')
  syncDetail(@Param('id') id: string, @Body('token') token: string) {
    return this.service.syncDetailFromPortal(id, token);
  }

  @RequirePermissions({ resource: 'invoices', action: 'update' })
  @Post(':id/net-off-vouchers')
  linkVouchers(
    @Param('id') id: string,
    @Body() payload: { bankTransactionId: string; netOffAmount?: number }[],
  ) {
    return this.service.linkVouchersToInvoice(id, payload);
  }

  @RequirePermissions({ resource: 'invoices', action: 'update' })
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
  @Post('portal/sync')
  syncPortal(@Body() dto: PortalFetchDto) {
    return this.service.syncFromPortal(dto);
  }

  /**
   * POST /api/v1/erp-invoices/portal/bulk-download-xml
   * Tải lại XML cho tất cả hóa đơn chưa có XML trong DB
   */
  @Post('portal/bulk-download-xml')
  bulkDownloadXml(@Body() body: { token: string; direction: 'IN' | 'OUT' }) {
    return this.service.bulkDownloadXml(body.token, body.direction);
  }

  // ---------------------------------------------------------------------------
  // Bulk XML import
  // ---------------------------------------------------------------------------

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
          file.mimetype === 'application/xml' ||
          file.mimetype === 'text/xml';
        if (!ok) {
          cb(
            new BadRequestException(
              `File "${file.originalname}" không phải .xml`,
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
      throw new BadRequestException('Chưa chọn file XML nào');
    }
    return this.service.bulkImportBuyerXml(
      files.map((f) => ({ filename: f.originalname, buffer: f.buffer })),
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
          file.mimetype === 'application/xml' ||
          file.mimetype === 'text/xml';
        if (!ok) {
          cb(
            new BadRequestException(
              `File "${file.originalname}" không phải .xml`,
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
      throw new BadRequestException('Chưa chọn file XML nào');
    }
    return this.service.bulkImportSellerXml(
      files.map((f) => ({ filename: f.originalname, buffer: f.buffer })),
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
    );
  }

  @Get(':id/pdfs/:key/download-url')
  getPdfDownloadUrl(@Param('id') id: string, @Param('key') key: string) {
    return this.service.getPdfDownloadUrl(id, decodeURIComponent(key));
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
    return this.service.progress$.pipe(
      map((data) => ({ data: JSON.stringify(data) }) as MessageEvent),
    );
  }
}
