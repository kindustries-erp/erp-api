import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CoreRbacGuard } from '@/auth/guards/core-rbac.guard';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import { ErpAction, ErpResource } from '@/v2/core/rbac-core';
import {
  FileCategory,
  FileOwnerType,
  STORAGE_HARD_LIMITS,
  extensionOf,
} from '@/v2/core/file-attachments-core';
import {
  DEFAULT_STORAGE_POLICY,
  FileAttachmentsService,
} from '@/v2/modules/file-attachments-management';
import {
  InvoiceAttachmentDownloadQueryDto,
  UploadInvoiceAttachmentBodyDto,
} from '../dto/invoice-attachment.dto';

interface RequestWithUser {
  user?: { sub?: string };
}

/** Chặn sớm file sai đuôi trước khi nạp vào RAM; policy chi tiết do service kiểm lại. */
const uploadFileFilter = (
  _req: unknown,
  file: { originalname: string },
  cb: (error: Error | null, accept: boolean) => void,
) => {
  const ext = extensionOf(file.originalname);
  if (DEFAULT_STORAGE_POLICY.allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new BadRequestException(`Không hỗ trợ định dạng .${ext || '?'}`), false);
  }
};

/**
 * File đính kèm của hóa đơn (controller mỏng của owner `INVOICE`). Mọi thao tác theo
 * `attachmentId` đều bị khóa theo hóa đơn ở service (chặn IDOR).
 */
@ApiTags('invoices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('api/v2/invoices/:id/attachments')
export class InvoiceAttachmentsController {
  constructor(private readonly files: FileAttachmentsService) {}

  @RequirePermissions({
    resource: ErpResource.INVOICES,
    action: ErpAction.READ,
  })
  @ApiOperation({
    summary: 'Danh sách tài liệu của hóa đơn (kèm policy upload)',
  })
  @Get()
  list(@Param('id', ParseUUIDPipe) id: string) {
    return this.files.listForOwner(FileOwnerType.INVOICE, id);
  }

  @RequirePermissions({
    resource: ErpResource.INVOICES,
    action: ErpAction.UPDATE,
  })
  @ApiOperation({ summary: 'Tải tài liệu lên hóa đơn (nhiều file)' })
  @ApiConsumes('multipart/form-data')
  @Post()
  @UseInterceptors(
    FilesInterceptor('files', STORAGE_HARD_LIMITS.maxFilesPerRequest, {
      limits: { fileSize: STORAGE_HARD_LIMITS.maxFileBytes },
      fileFilter: uploadFileFilter,
    }),
  )
  upload(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body() body: UploadInvoiceAttachmentBodyDto,
    @Req() req: RequestWithUser,
  ) {
    return this.files.uploadForOwner({
      ownerType: FileOwnerType.INVOICE,
      ownerId: id,
      files: files ?? [],
      category: body.category ?? FileCategory.HOA_DON,
      userId: req.user?.sub ?? null,
    });
  }

  @RequirePermissions({
    resource: ErpResource.INVOICES,
    action: ErpAction.READ,
  })
  @ApiOperation({ summary: 'Tải tất cả tài liệu của hóa đơn (zip)' })
  @Get('zip')
  async zip(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.files.zipForOwner(FileOwnerType.INVOICE, id);
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="invoice_${id}.zip"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }

  @RequirePermissions({
    resource: ErpResource.INVOICES,
    action: ErpAction.READ,
  })
  @ApiOperation({
    summary: 'URL tải/xem trước tài liệu (pre-signed, ngắn hạn)',
  })
  @Get(':attachmentId/download-url')
  downloadUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @Query() query: InvoiceAttachmentDownloadQueryDto,
  ) {
    return this.files.downloadUrlForOwner(
      FileOwnerType.INVOICE,
      id,
      attachmentId,
      query.inline ?? false,
    );
  }

  @RequirePermissions({
    resource: ErpResource.INVOICES,
    action: ErpAction.UPDATE,
  })
  @ApiOperation({ summary: 'Xóa mềm tài liệu của hóa đơn' })
  @Delete(':attachmentId')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.files.deleteForOwner(
      FileOwnerType.INVOICE,
      id,
      attachmentId,
      req.user?.sub ?? null,
    );
  }
}
