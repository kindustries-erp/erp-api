import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
  Request,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../auth/guards/core-rbac.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { ErpResource, ErpAction } from '@/rbac-core/enums';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ErpAttachmentsCoreService } from './erp-attachments-core.service';
import type { Response } from 'express';
import { ErpAttachment } from './entities/erp_attachment.entity';

@ApiTags('erp_attachments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('erp-attachments')
export class ErpAttachmentsCoreController {
  constructor(private readonly service: ErpAttachmentsCoreService) {}

  @RequirePermissions({
    resource: ErpResource.INVOICES,
    action: ErpAction.READ,
  })
  @Get()
  findAll(@Query() query: any) {
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
  ) {
    return this.service.getColumnOptions(
      column,
      search,
      page ? parseInt(page) : 1,
      pageSize ? parseInt(pageSize) : 20,
      filtersStr,
    );
  }

  @RequirePermissions({
    resource: ErpResource.INVOICES,
    action: ErpAction.UPDATE,
  })
  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit per file
    }),
  )
  async uploadFile(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('documentType') documentType: string,
    @Body('module') module: string,
    @Request() req: any,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Vui lòng chọn file');
    }

    const attachments: ErpAttachment[] = [];
    for (const file of files) {
      const att = await this.service.uploadFile(
        {
          filename: file.originalname,
          buffer: file.buffer,
          mimetype: file.mimetype,
        },
        documentType || 'KHAC',
        req.user?.sub,
        module,
      );
      attachments.push(att);
    }

    return { success: true, attachments };
  }

  @RequirePermissions({
    resource: ErpResource.INVOICES,
    action: ErpAction.DELETE,
  })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Get(':id/download-url')
  getDownloadUrl(@Param('id') id: string, @Query('inline') inline?: string) {
    return this.service.getDownloadUrl(id, inline === 'true');
  }

  @Get(':id/content')
  async getFileContent(@Param('id') id: string, @Res() res: Response) {
    const attachment = await this.service.findOne(id);
    const buffer = await this.service.getFileContent(id);
    res.set({
      'Content-Type': attachment.mimeType || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${attachment.fileName}"`,
      'Content-Length': buffer.length,
      'Cache-Control': 'private, max-age=300',
    });
    res.send(buffer);
  }
}
