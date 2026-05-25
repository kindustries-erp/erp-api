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
import { CashflowVoucherAttachmentsService } from './cashflow-voucher-attachments.service';
import { CreateCashflowVoucherAttachmentsDto } from './dto/create-cashflow-voucher-attachments.dto';
import { UpdateCashflowVoucherAttachmentsDto } from './dto/update-cashflow-voucher-attachments.dto';

import { GetCashflowVoucherAttachmentsDto } from './dto/get-cashflow-voucher-attachments.dto';

@ApiTags('CashflowVoucherAttachments')
@ApiBearerAuth()
@Controller('cashflow-voucher-attachments')
@UseGuards(DirectusAuthGuard)
export class CashflowVoucherAttachmentsController {
  constructor(
    private readonly cashflowVoucherAttachmentsService: CashflowVoucherAttachmentsService,
  ) {}

  @Post()
  create(
    @Body() dto: CreateCashflowVoucherAttachmentsDto,
    @UserToken() token: string,
  ) {
    return this.cashflowVoucherAttachmentsService.create(dto, token);
  }

  @Get()
  findAll(
    @Query() query: GetCashflowVoucherAttachmentsDto,
    @UserToken() token: string,
  ) {
    return this.cashflowVoucherAttachmentsService.findAll(query, token);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @UserToken() token: string) {
    return this.cashflowVoucherAttachmentsService.findOne(id, token);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCashflowVoucherAttachmentsDto,
    @UserToken() token: string,
  ) {
    return this.cashflowVoucherAttachmentsService.update(id, dto, token);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @UserToken() token: string) {
    return this.cashflowVoucherAttachmentsService.remove(id, token);
  }
}
