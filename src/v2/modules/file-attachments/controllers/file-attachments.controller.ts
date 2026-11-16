import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CoreRbacGuard } from '@/auth/guards/core-rbac.guard';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import { parseFilterRecord } from '@/common/utils/table-query';
import { ErpAction, ErpResource } from '@/v2/core/rbac-core';
import { FileAttachmentsService } from '../file-attachments.service';
import { QueryFileAttachmentDto } from '../dto/query-file-attachment.dto';
import { PurgeFileAttachmentsBodyDto } from '../dto/purge-file-attachments.dto';
import { UpdateFileAttachmentSettingsDto } from '../dto/update-file-attachment-settings.dto';

interface RequestWithUser {
  user?: { sub?: string };
}

/** `filters` là envelope `{columnFilters, columnSearch, columnOperators, dateRanges}` hoặc record `{cột: [giá trị]}`. */
function toFilterEnvelope(raw?: string) {
  const parsed = parseFilterRecord<Record<string, unknown>>(raw);
  if (!parsed) return {};
  const isEnvelope = [
    'columnFilters',
    'columnSearch',
    'columnOperators',
    'dateRanges',
  ].some((key) => key in parsed);
  const envelope = isEnvelope ? parsed : { columnFilters: parsed };
  return {
    column_filters: envelope.columnFilters,
    column_search: envelope.columnSearch,
    column_operators: envelope.columnOperators,
    date_ranges: envelope.dateRanges,
  };
}

const READ = { resource: ErpResource.ATTACHMENTS, action: ErpAction.READ };
const UPDATE = { resource: ErpResource.ATTACHMENTS, action: ErpAction.UPDATE };
const DELETE = { resource: ErpResource.ATTACHMENTS, action: ErpAction.DELETE };
const PURGE = { resource: ErpResource.ATTACHMENTS, action: ErpAction.PURGE };

/**
 * Quản lý file đính kèm toàn hệ thống. Route tĩnh (`column-options`, `settings`, `purge`)
 * khai báo trước route `:id`.
 */
@ApiTags('file-attachments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('api/v2/file-attachments')
export class FileAttachmentsController {
  constructor(private readonly files: FileAttachmentsService) {}

  @RequirePermissions(READ)
  @ApiOperation({
    summary: 'Danh sách tài liệu (deleted=only: chỉ file đã xóa mềm)',
  })
  @Get()
  list(@Query() query: QueryFileAttachmentDto) {
    return this.files.list(query);
  }

  @RequirePermissions(READ)
  @ApiOperation({ summary: 'Gợi ý giá trị của một cột' })
  @Get('column-options')
  columnOptions(
    @Query('column') column: string,
    @Query('search') search?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('deleted') deleted?: string,
    @Query('filters') filters?: string,
  ) {
    return this.files.columnOptions(
      column,
      search,
      Math.max(1, parseInt(page, 10) || 1),
      Math.max(1, Math.min(200, parseInt(pageSize, 10) || 20)),
      {
        deleted: deleted === 'only' ? 'only' : undefined,
        ...toFilterEnvelope(filters),
      },
    );
  }

  @RequirePermissions(READ)
  @ApiOperation({ summary: 'Cài đặt lưu giữ file' })
  @Get('settings')
  getSettings() {
    return this.files.getSettings();
  }

  @RequirePermissions(UPDATE)
  @ApiOperation({ summary: 'Đổi cài đặt lưu giữ (mặc định tắt tự động dọn)' })
  @Patch('settings')
  updateSettings(
    @Body() dto: UpdateFileAttachmentSettingsDto,
    @Req() req: RequestWithUser,
  ) {
    return this.files.updateSettings(dto, req.user?.sub ?? null);
  }

  @RequirePermissions(PURGE)
  @ApiOperation({ summary: 'Xóa vĩnh viễn nhiều file đã xóa mềm (tối đa 100)' })
  @Post('purge')
  purge(@Body() dto: PurgeFileAttachmentsBodyDto, @Req() req: RequestWithUser) {
    return this.files.purge(dto.ids, req.user?.sub ?? null);
  }

  @RequirePermissions(READ)
  @ApiOperation({ summary: 'Chi tiết tài liệu' })
  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.files.detail(id);
  }

  @RequirePermissions(READ)
  @ApiOperation({ summary: 'URL tải/xem trước (pre-signed, ngắn hạn)' })
  @Get(':id/download-url')
  downloadUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('inline') inline?: string,
  ) {
    return this.files.downloadUrl(id, inline === 'true');
  }

  @RequirePermissions(DELETE)
  @ApiOperation({ summary: 'Xóa mềm tài liệu' })
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: RequestWithUser) {
    return this.files.softDelete(id, req.user?.sub ?? null);
  }

  @RequirePermissions(PURGE)
  @ApiOperation({ summary: 'Xóa vĩnh viễn một file đã xóa mềm' })
  @Delete(':id/permanent')
  purgeOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ) {
    return this.files.purgeOne(id, req.user?.sub ?? null);
  }
}
