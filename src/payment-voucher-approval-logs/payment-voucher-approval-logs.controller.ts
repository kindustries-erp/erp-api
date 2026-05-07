import { UserToken } from '../common/decorators/user-token.decorator';
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { DirectusAuthGuard } from '../auth/guards/directus-auth.guard';
import { PaymentVoucherApprovalLogsService } from './payment-voucher-approval-logs.service';
import { CreatePaymentVoucherApprovalLogsDto } from './dto/create-payment-voucher-approval-logs.dto';
import { UpdatePaymentVoucherApprovalLogsDto } from './dto/update-payment-voucher-approval-logs.dto';
import { GetPaymentVoucherApprovalLogsDto } from './dto/get-payment-voucher-approval-logs.dto';

@ApiTags('PaymentVoucherApprovalLogs')
@ApiBearerAuth()
@Controller('payment-voucher-approval-logs')
@UseGuards(DirectusAuthGuard)
export class PaymentVoucherApprovalLogsController {
  constructor(
    private readonly paymentVoucherApprovalLogsService: PaymentVoucherApprovalLogsService,
  ) {}

  @Post()
  create(
    @Body() dto: CreatePaymentVoucherApprovalLogsDto,
    @UserToken() token: string,
  ) {
    return this.paymentVoucherApprovalLogsService.create(dto, token);
  }

  @Get()
  findAll(
    @Query() query: GetPaymentVoucherApprovalLogsDto,
    @UserToken() token: string,
  ) {
    return this.paymentVoucherApprovalLogsService.findAll(query, token);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @UserToken() token: string) {
    return this.paymentVoucherApprovalLogsService.findOne(id, token);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePaymentVoucherApprovalLogsDto,
    @UserToken() token: string,
  ) {
    return this.paymentVoucherApprovalLogsService.update(id, dto, token);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @UserToken() token: string) {
    return this.paymentVoucherApprovalLogsService.remove(id, token);
  }
}
