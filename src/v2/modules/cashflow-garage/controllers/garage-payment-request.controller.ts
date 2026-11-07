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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CoreRbacGuard } from '@/auth/guards/core-rbac.guard';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import { ErpAction, ErpResource } from '@/v2/core/rbac-core';
import { ApproverDirectoryService } from '@/v2/core/approval-core/approver-directory.service';
import type { CashflowForecastAction } from '@/v2/core/cashflow-core';
import {
  CreatePaymentRequestDto,
  ListPaymentRequestsQueryDto,
  PaymentRequestActionDto,
  RecordPaymentDto,
  ReplacePaymentRequestLinesDto,
  VoidPaymentDto,
} from '../dto/garage-payment-request.dto';
import { GaragePaymentRequestCommandService } from '../services/garage-payment-request-command.service';
import { GaragePaymentRequestPaymentService } from '../services/garage-payment-request-payment.service';
import { GaragePaymentRequestQueryService } from '../services/garage-payment-request-query.service';

interface RequestWithUser {
  user?: { sub?: string };
}

/**
 * Đề nghị thanh toán Garage. Route `api/v2/cashflow-garage/payment-requests`.
 * Controller mỏng: kiểm quyền, parse input, gọi service. Nghiệp vụ nằm ở service.
 */
@ApiTags('cashflow_garage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('api/v2/cashflow-garage/payment-requests')
export class GaragePaymentRequestController {
  constructor(
    private readonly command: GaragePaymentRequestCommandService,
    private readonly payments: GaragePaymentRequestPaymentService,
    private readonly query: GaragePaymentRequestQueryService,
    private readonly approvers: ApproverDirectoryService,
  ) {}

  @Get()
  @RequirePermissions({
    resource: ErpResource.GARAGE_PAYMENT_REQUESTS,
    action: ErpAction.READ,
  })
  @ApiOperation({ summary: 'Danh sách đề nghị thanh toán Garage' })
  list(@Query() query: ListPaymentRequestsQueryDto) {
    return this.query.list(query);
  }

  @Get(':id')
  @RequirePermissions({
    resource: ErpResource.GARAGE_PAYMENT_REQUESTS,
    action: ErpAction.READ,
  })
  @ApiOperation({ summary: 'Chi tiết đề nghị kèm dòng và thực chi' })
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.query.detail(id);
  }

  @Post()
  @RequirePermissions({
    resource: ErpResource.GARAGE_PAYMENT_REQUESTS,
    action: ErpAction.CREATE,
  })
  @ApiOperation({
    summary: 'Tạo đề nghị thanh toán từ các đơn mua đã phát hành',
  })
  create(@Body() dto: CreatePaymentRequestDto, @Req() req: RequestWithUser) {
    return this.command.createRequest(
      { id: req.user?.sub ?? '', roles: [] },
      dto,
    );
  }

  @Patch(':id/lines')
  @RequirePermissions({
    resource: ErpResource.GARAGE_PAYMENT_REQUESTS,
    action: ErpAction.UPDATE,
  })
  @ApiOperation({ summary: 'Thay dòng đề nghị (chỉ khi DRAFT)' })
  replaceLines(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplacePaymentRequestLinesDto,
  ) {
    return this.command.replaceLines(id, dto.lines);
  }

  @Post(':id/submit')
  @RequirePermissions({
    resource: ErpResource.GARAGE_PAYMENT_REQUESTS,
    action: ErpAction.UPDATE,
  })
  @ApiOperation({ summary: 'Gửi duyệt' })
  submit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PaymentRequestActionDto,
    @Req() req: RequestWithUser,
  ) {
    return this.transition(id, 'submit', req, dto);
  }

  @Post(':id/recall')
  @RequirePermissions({
    resource: ErpResource.GARAGE_PAYMENT_REQUESTS,
    action: ErpAction.UPDATE,
  })
  @ApiOperation({ summary: 'Thu hồi về nháp' })
  recall(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PaymentRequestActionDto,
    @Req() req: RequestWithUser,
  ) {
    return this.transition(id, 'recall', req, dto);
  }

  @Post(':id/approve')
  @RequirePermissions({
    resource: ErpResource.GARAGE_PAYMENT_REQUESTS,
    action: ErpAction.APPROVE,
  })
  @ApiOperation({ summary: 'Duyệt (chuyển sang APPROVED, sẵn sàng chi)' })
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PaymentRequestActionDto,
    @Req() req: RequestWithUser,
  ) {
    return this.transition(id, 'approve', req, dto);
  }

  @Post(':id/reject')
  @RequirePermissions({
    resource: ErpResource.GARAGE_PAYMENT_REQUESTS,
    action: ErpAction.REJECT,
  })
  @ApiOperation({ summary: 'Từ chối (bắt buộc lý do)' })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PaymentRequestActionDto,
    @Req() req: RequestWithUser,
  ) {
    return this.transition(id, 'reject', req, dto);
  }

  @Post(':id/cancel')
  @RequirePermissions({
    resource: ErpResource.GARAGE_PAYMENT_REQUESTS,
    action: ErpAction.DELETE,
  })
  @ApiOperation({
    summary: 'Hủy đề nghị (bắt buộc lý do, chặn khi đã có thực chi)',
  })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PaymentRequestActionDto,
    @Req() req: RequestWithUser,
  ) {
    return this.transition(id, 'cancel', req, dto);
  }

  @Post(':id/payments')
  @RequirePermissions({
    resource: ErpResource.GARAGE_PAYMENT_REQUESTS,
    action: ErpAction.CREATE,
  })
  @ApiOperation({ summary: 'Ghi chi (một phần hoặc đủ), chia theo dòng' })
  recordPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordPaymentDto,
    @Req() req: RequestWithUser,
  ) {
    return this.payments.recordPayment(
      id,
      {
        amount: dto.amount,
        transDate: dto.transDate,
        channel: dto.channel,
        note: dto.note ?? null,
      },
      req.user?.sub ?? '',
    );
  }

  @Post(':id/payments/:paymentId/void')
  @RequirePermissions({
    resource: ErpResource.GARAGE_PAYMENT_REQUESTS,
    action: ErpAction.DELETE,
  })
  @ApiOperation({ summary: 'Hủy một lần chi (bắt buộc lý do)' })
  voidPayment(
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Body() dto: VoidPaymentDto,
  ) {
    return this.payments.voidPayment(paymentId, dto.reason);
  }

  private async transition(
    id: string,
    action: CashflowForecastAction,
    req: RequestWithUser,
    dto: PaymentRequestActionDto,
  ) {
    const actorId = req.user?.sub ?? '';
    if (dto.approverId) {
      await this.approvers.assertEligible(
        ErpResource.GARAGE_PAYMENT_REQUESTS,
        dto.approverId,
        actorId,
      );
    }
    const header = await this.command.transition(
      id,
      action,
      { id: actorId, roles: [] },
      dto.reason ?? null,
      { approverId: dto.approverId ?? null },
    );
    return this.query.detail(header.id);
  }
}
