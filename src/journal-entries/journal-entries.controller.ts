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
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../rbac-core/guards/permissions.guard';
import { Permissions } from '../rbac-core/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JournalEntriesService } from './journal-entries.service';
import { JournalEntryQueryDto } from './dto/journal-entry-query.dto';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';
import { UpdateJournalEntryDto } from './dto/update-journal-entry.dto';
import { FileInterceptor } from '@nestjs/platform-express';

@ApiTags('JournalEntries')
@ApiBearerAuth()
@Controller('journal-entries')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class JournalEntriesController {
  constructor(private readonly journalEntriesService: JournalEntriesService) {}

  @ApiOperation({ summary: 'Danh sách bút toán' })
  @Get()
  @Permissions('read:journal_entries')
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
  @Permissions('read:journal_entries')
  findOne(@Param('id') id: string) {
    return this.journalEntriesService.findOne(id);
  }

  @ApiOperation({ summary: 'Tạo bút toán thủ công (Phiếu Khác)' })
  @Post()
  @Permissions('create:journal_entries')
  create(@Body() dto: CreateJournalEntryDto, @CurrentUser() user: any) {
    return this.journalEntriesService.create(dto, user.id);
  }

  @ApiOperation({ summary: 'Cập nhật bút toán (chỉ tk và diễn giải)' })
  @Patch(':id')
  @Permissions('update:journal_entries')
  update(@Param('id') id: string, @Body() dto: UpdateJournalEntryDto) {
    return this.journalEntriesService.update(id, dto);
  }

  @ApiOperation({ summary: 'Lấy chi tiết chứng từ gốc' })
  @Get(':id/source-document')
  @Permissions('read:journal_entries')
  getSourceDocument(@Param('id') id: string) {
    return this.journalEntriesService.getSourceDocument(id);
  }

  @ApiOperation({ summary: 'Hạch toán bút toán (draft -> posted)' })
  @Post(':id/post')
  @Permissions('update:journal_entries')
  post(@Param('id') id: string) {
    return this.journalEntriesService.post(id);
  }

  @ApiOperation({ summary: 'Upload file đính kèm R2' })
  @Post(':id/attachments')
  @Permissions('update:journal_entries', 'create:journal_entries')
  @UseInterceptors(FileInterceptor('file'))
  addAttachment(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
  ) {
    return this.journalEntriesService.addAttachment(id, file, user.id);
  }

  @ApiOperation({ summary: 'Lấy URL tải file R2' })
  @Get(':id/attachments/:attachmentId/download')
  @Permissions('read:journal_entries')
  getAttachmentDownloadUrl(@Param('attachmentId') attachmentId: string) {
    return this.journalEntriesService.getAttachmentDownloadUrl(attachmentId);
  }

  @ApiOperation({ summary: 'Xóa file đính kèm' })
  @Delete(':id/attachments/:attachmentId')
  @Permissions('update:journal_entries')
  removeAttachment(@Param('attachmentId') attachmentId: string) {
    return this.journalEntriesService.removeAttachment(attachmentId);
  }
}
