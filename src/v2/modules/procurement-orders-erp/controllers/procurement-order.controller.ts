import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ProcurementOrderListResponseDto } from '@/v2/core/procurement-orders-core/dto/procurement-order-list-response.dto';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CoreRbacGuard } from '@/auth/guards/core-rbac.guard';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import { ErpAction, ErpResource } from '@/v2/core/rbac-core';
import { ReasonDto } from '@/v2/core/approval-core/reason.dto';
import {
  AcceptServicesDto,
  CreateProcurementOrderDto,
  ListProcurementOrdersDto,
  ReceiveGoodsDto,
  ReplaceOrderLinesDto,
} from '../dto/procurement-order.dto';
import { ErpProcurementOrdersService } from '../procurement-orders-erp.service';

interface RequestWithUser {
  user?: { sub?: string };
}

@ApiTags('procurement_orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('api/v2/procurement-orders-erp')
export class ErpProcurementOrderController {
  constructor(private readonly service: ErpProcurementOrdersService) {}

  @RequirePermissions({
    resource: ErpResource.PROCUREMENT_ORDERS,
    action: ErpAction.CREATE,
  })
  @Post()
  create(@Body() dto: CreateProcurementOrderDto, @Req() req: RequestWithUser) {
    return this.service.create(dto, req.user?.sub ?? '');
  }

  @RequirePermissions({
    resource: ErpResource.PROCUREMENT_ORDERS,
    action: ErpAction.READ,
  })
  @ApiOkResponse({ type: ProcurementOrderListResponseDto })
  @Get()
  list(@Query() dto: ListProcurementOrdersDto) {
    return this.service.list(dto);
  }

  @RequirePermissions({
    resource: ErpResource.PROCUREMENT_ORDERS,
    action: ErpAction.READ,
  })
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @RequirePermissions({
    resource: ErpResource.PROCUREMENT_ORDERS,
    action: ErpAction.UPDATE,
  })
  @ApiOperation({
    summary: 'Thay dòng khi còn nháp (trả và giữ lại số lượng PR)',
  })
  @Patch(':id/lines')
  replaceLines(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplaceOrderLinesDto,
  ) {
    return this.service.replaceLines(id, dto);
  }

  @RequirePermissions({
    resource: ErpResource.PROCUREMENT_ORDERS,
    action: ErpAction.READ,
  })
  @ApiOperation({ summary: 'Nhật ký các bước duyệt của đơn mua' })
  @Get(':id/approval-events')
  approvalEvents(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.approvalEvents(id);
  }

  @RequirePermissions({
    resource: ErpResource.PROCUREMENT_ORDERS,
    action: ErpAction.UPDATE,
  })
  @Post(':id/submit')
  submit(@Param('id', ParseUUIDPipe) id: string, @Req() req: RequestWithUser) {
    return this.service.transition(id, 'submit', req.user?.sub ?? '');
  }

  @RequirePermissions({
    resource: ErpResource.PROCUREMENT_ORDERS,
    action: ErpAction.UPDATE,
  })
  @Post(':id/recall')
  recall(@Param('id', ParseUUIDPipe) id: string, @Req() req: RequestWithUser) {
    return this.service.transition(id, 'recall', req.user?.sub ?? '');
  }

  @RequirePermissions({
    resource: ErpResource.PROCUREMENT_ORDERS,
    action: ErpAction.APPROVE,
  })
  @ApiOperation({ summary: 'Duyệt đơn (không được tự duyệt)' })
  @Post(':id/approve')
  approve(@Param('id', ParseUUIDPipe) id: string, @Req() req: RequestWithUser) {
    return this.service.transition(id, 'approve', req.user?.sub ?? '');
  }

  @RequirePermissions({
    resource: ErpResource.PROCUREMENT_ORDERS,
    action: ErpAction.REJECT,
  })
  @Post(':id/reject')
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
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
    resource: ErpResource.PROCUREMENT_ORDERS,
    action: ErpAction.UPDATE,
  })
  @ApiOperation({ summary: 'Phát hành đơn cho NCC (chỉ từ APPROVED)' })
  @Post(':id/issue')
  issue(@Param('id', ParseUUIDPipe) id: string, @Req() req: RequestWithUser) {
    return this.service.transition(id, 'issue', req.user?.sub ?? '');
  }

  @RequirePermissions({
    resource: ErpResource.PROCUREMENT_ORDERS,
    action: ErpAction.UPDATE,
  })
  @Post(':id/cancel')
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
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
    resource: ErpResource.PROCUREMENT_ORDERS,
    action: ErpAction.UPDATE,
  })
  @ApiOperation({ summary: 'Đóng thiếu đơn, bắt buộc lý do' })
  @Post(':id/close')
  close(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
    @Req() req: RequestWithUser,
  ) {
    return this.service.transition(
      id,
      'close',
      req.user?.sub ?? '',
      dto.reason,
    );
  }

  @RequirePermissions({
    resource: ErpResource.PROCUREMENT_ORDERS,
    action: ErpAction.UPDATE,
  })
  @ApiOperation({ summary: 'Nhận hàng GOODS đã phát hành' })
  @Post(':id/receipts')
  receive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReceiveGoodsDto,
  ) {
    return this.service.receiveGoods(id, dto);
  }

  @RequirePermissions({
    resource: ErpResource.PROCUREMENT_ORDERS,
    action: ErpAction.UPDATE,
  })
  @ApiOperation({ summary: 'Nghiệm thu dịch vụ đã phát hành' })
  @Post(':id/acceptances')
  accept(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AcceptServicesDto,
    @Req() req: RequestWithUser,
  ) {
    return this.service.acceptServices(id, dto, req.user?.sub ?? '');
  }

  @RequirePermissions({
    resource: ErpResource.PROCUREMENT_ORDERS,
    action: ErpAction.UPDATE,
  })
  @ApiOperation({ summary: 'Hủy biên bản nghiệm thu, bắt buộc lý do' })
  @Post(':id/acceptances/:acceptanceId/void')
  voidAcceptance(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('acceptanceId', ParseUUIDPipe) acceptanceId: string,
    @Body() dto: ReasonDto,
    @Req() req: RequestWithUser,
  ) {
    return this.service.voidAcceptance(
      id,
      acceptanceId,
      req.user?.sub ?? '',
      dto.reason,
    );
  }
}
