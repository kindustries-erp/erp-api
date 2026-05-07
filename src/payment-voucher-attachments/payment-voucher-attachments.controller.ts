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
import { PaymentVoucherAttachmentsService } from './payment-voucher-attachments.service';
import { CreatePaymentVoucherAttachmentsDto } from './dto/create-payment-voucher-attachments.dto';
import { UpdatePaymentVoucherAttachmentsDto } from './dto/update-payment-voucher-attachments.dto';

import { GetPaymentVoucherAttachmentsDto } from './dto/get-payment-voucher-attachments.dto';

@ApiTags('PaymentVoucherAttachments')
@ApiBearerAuth()
@Controller('payment-voucher-attachments')
@UseGuards(DirectusAuthGuard)
export class PaymentVoucherAttachmentsController {
  constructor(
    private readonly paymentVoucherAttachmentsService: PaymentVoucherAttachmentsService,
  ) {}

  @Post()
  create(
    @Body() dto: CreatePaymentVoucherAttachmentsDto,
    @UserToken() token: string,
  ) {
    return this.paymentVoucherAttachmentsService.create(dto, token);
  }

  @Get()
  findAll(
    @Query() query: GetPaymentVoucherAttachmentsDto,
    @UserToken() token: string,
  ) {
    return this.paymentVoucherAttachmentsService.findAll(query, token);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @UserToken() token: string) {
    return this.paymentVoucherAttachmentsService.findOne(id, token);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePaymentVoucherAttachmentsDto,
    @UserToken() token: string,
  ) {
    return this.paymentVoucherAttachmentsService.update(id, dto, token);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @UserToken() token: string) {
    return this.paymentVoucherAttachmentsService.remove(id, token);
  }
}
