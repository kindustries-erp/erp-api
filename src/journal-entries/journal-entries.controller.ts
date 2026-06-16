import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Delete,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../auth/guards/core-rbac.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JournalEntriesService } from './journal-entries.service';
import { JournalEntryQueryDto } from './dto/journal-entry-query.dto';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';
import { UpdateJournalEntryDto } from './dto/update-journal-entry.dto';
import { FileInterceptor } from '@nestjs/platform-express';

@ApiTags('JournalEntries')
@ApiBearerAuth()
@Controller('journal-entries')
@UseGuards(JwtAuthGuard, CoreRbacGuard)
export class JournalEntriesController {
  constructor(private readonly journalEntriesService: JournalEntriesService) {}

  @ApiOperation({ summary: 'Danh sách bút toán' })
  @Get()
  @RequirePermissions({ resource: 'journal_entries', action: 'read' })
  findAll(@Query() query: JournalEntryQueryDto) {
    return this.journalEntriesService.findAll(query);
  }

  @ApiOperation({ summary: 'Lookup: danh sách kỳ kế toán' })
  @Get('lookup/periods')
  findPeriodOptions() {
    return this.journalEntriesService.findPeriodOptions();
  }

  @ApiOperation({ summary: 'Lookup: danh sách tài khoản kế toán' })
  @Get('lookup/accounts')
  findAccountOptions(@Query('search') search: string) {
    return this.journalEntriesService.findAccountOptions(search);
  }

  @ApiOperation({ summary: 'Chi tiết bút toán (bao gồm các dòng)' })
  @Get(':id')
  @RequirePermissions({ resource: 'journal_entries', action: 'read' })
  findOne(@Param('id') id: string) {
    return this.journalEntriesService.findOne(id);
  }

  @ApiOperation({ summary: 'Tạo bút toán thủ công (Phiếu Khác)' })
  @Post()
  @RequirePermissions({ resource: 'journal_entries', action: 'create' })
  create(@Body() dto: CreateJournalEntryDto, @Req() req: any) {
    return this.journalEntriesService.create(dto, req.user.sub);
  }

  @ApiOperation({ summary: 'Cập nhật bút toán (chỉ tk và diễn giải)' })
  @Patch(':id')
  @RequirePermissions({ resource: 'journal_entries', action: 'update' })
  update(@Param('id') id: string, @Body() dto: UpdateJournalEntryDto) {
    return this.journalEntriesService.update(id, dto);
  }

  @ApiOperation({ summary: 'Lấy chi tiết chứng từ gốc' })
  @Get(':id/source-document')
  @RequirePermissions({ resource: 'journal_entries', action: 'read' })
  getSourceDocument(@Param('id') id: string) {
    return this.journalEntriesService.getSourceDocument(id);
  }

  @ApiOperation({ summary: 'Hạch toán bút toán (draft -> posted)' })
  @Post(':id/post')
  @RequirePermissions({ resource: 'journal_entries', action: 'update' })
  post(@Param('id') id: string) {
    return this.journalEntriesService.post(id);
  }

  @ApiOperation({ summary: 'Upload file đính kèm R2' })
  @Post(':id/attachments')
  @RequirePermissions({ resource: 'journal_entries', action: 'update' })
  @UseInterceptors(FileInterceptor('file'))
  addAttachment(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    return this.journalEntriesService.addAttachment(id, file, req.user.sub);
  }

  @ApiOperation({ summary: 'Lấy URL tải file R2' })
  @Get(':id/attachments/:attachmentId/download')
  @RequirePermissions({ resource: 'journal_entries', action: 'read' })
  getAttachmentDownloadUrl(@Param('attachmentId') attachmentId: string) {
    return this.journalEntriesService.getAttachmentDownloadUrl(attachmentId);
  }

  @ApiOperation({ summary: 'Xóa file đính kèm' })
  @Delete(':id/attachments/:attachmentId')
  @RequirePermissions({ resource: 'journal_entries', action: 'update' })
  removeAttachment(@Param('attachmentId') attachmentId: string) {
    return this.journalEntriesService.removeAttachment(attachmentId);
  }
}
