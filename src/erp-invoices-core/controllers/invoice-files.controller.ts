import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Request,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../../auth/guards/core-rbac.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { ErpResource, ErpAction } from '@/rbac-core/enums';
import { ErpInvoicesCoreService } from '../erp-invoices-core.service';
import type { ErpInvoiceQuery } from '../erp-invoices-core.service';

/**
 * Endpoint tệp đính kèm, PDF/XML và tải zip của hóa đơn.
 * Tách khỏi ErpInvoicesCoreController; giữ nguyên path, guard và DTO.
 */
@ApiTags('erp_invoices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('erp-invoices')
export class InvoiceFilesController {
  constructor(private readonly service: ErpInvoicesCoreService) {}

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
        'Vui lòng chọn ít nhất 1 loại file (pdf, xml, zip)',
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
        'Vui lòng chọn ít nhất 1 loại file (pdf, xml, zip)',
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
}
