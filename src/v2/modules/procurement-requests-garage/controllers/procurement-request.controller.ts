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
import { ErpAction, ErpResource } from '@/v2/core/rbac-core';

import {
  CreateProcurementRequestDto,
  ListProcurementRequestsDto,
  ReplaceRequestLinesDto,
  UpdateProcurementRequestHeaderDto,
  ReasonBodyDto,
} from '../dto/procurement-request.dto';
import { GarageProcurementRequestsService } from '../procurement-requests-garage.service';

interface RequestWithUser {
  user?: { sub?: string };
}

@ApiTags('procurement_requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('api/v2/garage-procurement-requests')
export class GarageProcurementRequestController {
  constructor(private readonly service: GarageProcurementRequestsService) {}

  @RequirePermissions({
    resource: ErpResource.GARAGE_PROCUREMENT_REQUESTS,
    action: ErpAction.CREATE,
  })
  @ApiOperation({ summary: 'Tạo đề nghị mua ở trạng thái nháp' })
  @Post()
  create(
    @Body() dto: CreateProcurementRequestDto,
    @Req() req: RequestWithUser,
  ) {
    return this.service.create(dto, req.user?.sub ?? '');
  }

  @RequirePermissions({
    resource: ErpResource.GARAGE_PROCUREMENT_REQUESTS,
    action: ErpAction.READ,
  })
  @Get()
  list(@Query() dto: ListProcurementRequestsDto) {
    return this.service.list(dto);
  }

  @RequirePermissions({
    resource: ErpResource.GARAGE_PROCUREMENT_REQUESTS,
    action: ErpAction.READ,
  })
  @ApiOperation({
    summary: 'Gợi ý giá trị của một cột, áp dụng bộ lọc các cột khác',
  })
  @Get('column-options')
  columnOptions(
    @Query('column') column: string,
    @Query('search') search?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('filters') filters?: string,
  ) {
    return this.service.findColumnOptions(
      column,
      search,
      Math.max(1, parseInt(page, 10) || 1),
      Math.max(1, Math.min(200, parseInt(pageSize, 10) || 20)),
      filters,
    );
  }

  @RequirePermissions({
    resource: ErpResource.GARAGE_PROCUREMENT_REQUESTS,
    action: ErpAction.READ,
  })
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @RequirePermissions({
    resource: ErpResource.GARAGE_PROCUREMENT_REQUESTS,
    action: ErpAction.READ,
  })
  @ApiOperation({ summary: 'Nhật ký các bước duyệt của đề nghị' })
  @Get(':id/approval-events')
  approvalEvents(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.approvalEvents(id);
  }

  @RequirePermissions({
    resource: ErpResource.GARAGE_PROCUREMENT_REQUESTS,
    action: ErpAction.READ,
  })
  @ApiOperation({ summary: 'Bản nháp PO điền sẵn phần còn lại (chỉ đọc)' })
  @Get(':id/po-draft')
  poDraft(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.poDraft(id);
  }

  @RequirePermissions({
    resource: ErpResource.GARAGE_PROCUREMENT_REQUESTS,
    action: ErpAction.UPDATE,
  })
  @ApiOperation({ summary: 'Sửa đầu đề khi còn nháp (không đổi chi nhánh)' })
  @Patch(':id')
  updateHeader(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProcurementRequestHeaderDto,
  ) {
    return this.service.updateHeader(id, dto);
  }

  @RequirePermissions({
    resource: ErpResource.GARAGE_PROCUREMENT_REQUESTS,
    action: ErpAction.UPDATE,
  })
  @ApiOperation({ summary: 'Thay dòng khi còn nháp' })
  @Patch(':id/lines')
  replaceLines(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplaceRequestLinesDto,
  ) {
    return this.service.replaceLines(id, dto);
  }

  @RequirePermissions({
    resource: ErpResource.GARAGE_PROCUREMENT_REQUESTS,
    action: ErpAction.DELETE,
  })
  @ApiOperation({ summary: 'Xóa mềm đề nghị nháp' })
  @Delete(':id')
  softDelete(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.softDelete(id);
  }

  @RequirePermissions({
    resource: ErpResource.GARAGE_PROCUREMENT_REQUESTS,
    action: ErpAction.PURGE,
  })
  @ApiOperation({
    summary: 'Xóa cứng đề nghị nháp (chỉ quyền PURGE, chặn khi còn đơn mua)',
  })
  @Delete(':id/permanent')
  hardDelete(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.hardDelete(id);
  }

  @RequirePermissions({
    resource: ErpResource.GARAGE_PROCUREMENT_REQUESTS,
    action: ErpAction.UPDATE,
  })
  @Post(':id/submit')
  submit(@Param('id', ParseUUIDPipe) id: string, @Req() req: RequestWithUser) {
    return this.service.transition(id, 'submit', req.user?.sub ?? '');
  }

  @RequirePermissions({
    resource: ErpResource.GARAGE_PROCUREMENT_REQUESTS,
    action: ErpAction.UPDATE,
  })
  @Post(':id/recall')
  recall(@Param('id', ParseUUIDPipe) id: string, @Req() req: RequestWithUser) {
    return this.service.transition(id, 'recall', req.user?.sub ?? '');
  }

  @RequirePermissions({
    resource: ErpResource.GARAGE_PROCUREMENT_REQUESTS,
    action: ErpAction.APPROVE,
  })
  @ApiOperation({ summary: 'Duyệt đề nghị (không được tự duyệt)' })
  @Post(':id/approve')
  approve(@Param('id', ParseUUIDPipe) id: string, @Req() req: RequestWithUser) {
    return this.service.transition(id, 'approve', req.user?.sub ?? '');
  }

  @RequirePermissions({
    resource: ErpResource.GARAGE_PROCUREMENT_REQUESTS,
    action: ErpAction.REJECT,
  })
  @ApiOperation({ summary: 'Từ chối đề nghị, bắt buộc lý do, về nháp' })
  @Post(':id/reject')
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonBodyDto,
    @Req() req: RequestWithUser,
  ) {
    return this.service.transition(
      id,
      'reject',
      req.user?.sub ?? '',
      dto.reason,
    );
  }

  @RequirePermissions({
    resource: ErpResource.GARAGE_PROCUREMENT_REQUESTS,
    action: ErpAction.UPDATE,
  })
  @Post(':id/cancel')
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonBodyDto,
    @Req() req: RequestWithUser,
  ) {
    return this.service.transition(
      id,
      'cancel',
      req.user?.sub ?? '',
      dto.reason,
    );
  }

  @RequirePermissions({
    resource: ErpResource.GARAGE_PROCUREMENT_REQUESTS,
    action: ErpAction.UPDATE,
  })
  @Post(':id/close')
  close(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonBodyDto,
    @Req() req: RequestWithUser,
  ) {
    return this.service.transition(
      id,
      'close',
      req.user?.sub ?? '',
      dto.reason,
    );
  }
}
