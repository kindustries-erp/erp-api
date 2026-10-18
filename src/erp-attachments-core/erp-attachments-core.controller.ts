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
  UploadedFiles,
  BadRequestException,
  Request,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiTags,
  ApiOperation,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../auth/guards/core-rbac.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { ErpResource, ErpAction } from '@/rbac-core/enums';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ErpAttachmentsCoreService } from './erp-attachments-core.service';
import type { Response } from 'express';
import { ErpAttachment } from './entities/erp_attachment.entity';
import {
  ListAttachmentsDto,
  AttachmentColumnOptionsDto,
} from './dto/list-attachments.dto';

@ApiTags('erp_attachments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('erp-attachments')
export class ErpAttachmentsCoreController {
  constructor(private readonly service: ErpAttachmentsCoreService) {}

  @RequirePermissions({
    resource: ErpResource.ATTACHMENTS,
    action: ErpAction.READ,
  })
  @ApiOperation({
    summary: 'Lấy danh sách tài liệu đính kèm phân trang và lọc',
  })
  @Get()
  findAll(@Query() query: ListAttachmentsDto) {
    return this.service.findAll(query);
  }

  @RequirePermissions({
    resource: ErpResource.ATTACHMENTS,
    action: ErpAction.READ,
  })
  @ApiOperation({ summary: 'Lấy danh sách options lọc động cho cột' })
  @Get('column-options')
  getColumnOptions(@Query() query: AttachmentColumnOptionsDto) {
    return this.service.getColumnOptions(
      query.column || '',
      query.search || '',
      query.page ? parseInt(query.page) : 1,
      query.pageSize ? parseInt(query.pageSize) : 20,
      query.column_filters,
    );
  }

  @RequirePermissions({
    resource: ErpResource.ATTACHMENTS,
    action: ErpAction.CREATE,
  })
  @ApiOperation({ summary: 'Tải lên tập tin đính kèm mới' })
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
    resource: ErpResource.ATTACHMENTS,
    action: ErpAction.DELETE,
  })
  @ApiOperation({ summary: 'Xóa tài liệu đính kèm' })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @RequirePermissions({
    resource: ErpResource.ATTACHMENTS,
    action: ErpAction.READ,
  })
  @ApiOperation({ summary: 'Lấy URL tải/xem trước tài liệu' })
  @Get(':id/download-url')
  getDownloadUrl(@Param('id') id: string, @Query('inline') inline?: string) {
    return this.service.getDownloadUrl(id, inline === 'true');
  }

  @RequirePermissions({
    resource: ErpResource.ATTACHMENTS,
    action: ErpAction.READ,
  })
  @ApiOperation({ summary: 'Tải nội dung trực tiếp dạng stream/blob' })
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
