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
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DirectusAuthGuard } from '../auth/guards/directus-auth.guard';
import { PaymentVoucherQueryDto } from './dto/payment-voucher-query.dto';
import { PaymentVoucherSummaryQueryDto } from './dto/payment-voucher-summary-query.dto';
import { PaymentVouchersService } from './payment-vouchers.service';
import { CreatePaymentVouchersDto } from './dto/create-payment-vouchers.dto';
import { UpdatePaymentVouchersDto } from './dto/update-payment-vouchers.dto';
import {
  VoucherApproveDto,
  VoucherRejectDto,
  VoucherCancelDto,
} from './dto/voucher-action.dto';
import { CreateJournalEntryDto } from '../journal-entries/dto/create-journal-entry.dto';

@ApiTags('PaymentVouchers')
@ApiBearerAuth()
@Controller('payment-vouchers')
@UseGuards(DirectusAuthGuard)
export class PaymentVouchersController {
  constructor(
    private readonly paymentVouchersService: PaymentVouchersService,
  ) {}

  @Post()
  create(@Body() dto: CreatePaymentVouchersDto, @UserToken() token: string) {
    return this.paymentVouchersService.create(dto, token);
  }

  @Get()
  findAll(@Query() query: PaymentVoucherQueryDto, @UserToken() token: string) {
    return this.paymentVouchersService.findAll(query, token);
  }

  @Get('summary')
  getSummary(
    @Query() query: PaymentVoucherSummaryQueryDto,
    @UserToken() token: string,
  ) {
    return this.paymentVouchersService.getSummary(query, token);
  }

  @ApiOperation({ summary: 'Danh sách nhân viên phục vụ lập phiếu thu chi' })
  @Get('lookup/employees')
  findEmployeeOptions(
    @Query() query: PaymentVoucherQueryDto,
    @UserToken() token: string,
  ) {
    return this.paymentVouchersService.findEmployeeOptions(query, token);
  }

  @ApiOperation({ summary: 'Danh sách đối tác phục vụ lập phiếu thu chi' })
  @Get('lookup/business-partners')
  findBusinessPartnerOptions(
    @Query() query: PaymentVoucherQueryDto,
    @UserToken() token: string,
  ) {
    return this.paymentVouchersService.findBusinessPartnerOptions(query, token);
  }

  @ApiOperation({
    summary: 'Danh sách tag gợi ý Cash/Bank để gắn preset chứng từ',
  })
  @Get('lookup/cash-bank-tag-presets')
  findCashBankTagPresets(
    @Query() query: PaymentVoucherQueryDto,
    @UserToken() token: string,
  ) {
    return this.paymentVouchersService.findCashBankTagPresets(query, token);
  }

  @ApiOperation({
    summary: 'Danh sách tài khoản ngân hàng đối tác phục vụ lập phiếu thu chi',
  })
  @Get('lookup/business-partner-bank-accounts')
  findBusinessPartnerBankAccountOptions(
    @Query() query: PaymentVoucherQueryDto,
    @UserToken() token: string,
  ) {
    return this.paymentVouchersService.findBusinessPartnerBankAccountOptions(
      query,
      token,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string, @UserToken() token: string) {
    return this.paymentVouchersService.findOne(id, token);
  }

  @Get(':id/timeline')
  getTimeline(@Param('id') id: string, @UserToken() token: string) {
    return this.paymentVouchersService.getTimeline(id, token);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePaymentVouchersDto,
    @UserToken() token: string,
  ) {
    return this.paymentVouchersService.update(id, dto, token);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @UserToken() token: string) {
    return this.paymentVouchersService.remove(id, token);
  }

  // ─── Status transition actions ───────────────────────────────────────────

  @ApiOperation({ summary: 'Gửi phiếu chờ duyệt (DRAFT → PENDING_APPROVAL)' })
  @Post(':id/submit')
  submitForApproval(@Param('id') id: string, @UserToken() token: string) {
    return this.paymentVouchersService.submitForApproval(id, token);
  }

  @ApiOperation({
    summary: 'Duyệt phiếu (PENDING_APPROVAL → CONFIRMED)',
  })
  @Post(':id/approve')
  approve(
    @Param('id') id: string,
    @Body() dto: VoucherApproveDto,
    @UserToken() token: string,
  ) {
    return this.paymentVouchersService.approve(id, dto, token);
  }

  @ApiOperation({ summary: 'Từ chối phiếu (PENDING_APPROVAL → REJECTED)' })
  @Post(':id/reject')
  reject(
    @Param('id') id: string,
    @Body() dto: VoucherRejectDto,
    @UserToken() token: string,
  ) {
    return this.paymentVouchersService.reject(id, dto, token);
  }

  @ApiOperation({
    summary: 'Hủy phiếu (DRAFT/PENDING_APPROVAL/CONFIRMED → CANCELLED)',
  })
  @Post(':id/cancel')
  cancel(
    @Param('id') id: string,
    @Body() dto: VoucherCancelDto,
    @UserToken() token: string,
  ) {
    return this.paymentVouchersService.cancel(id, dto, token);
  }

  @ApiOperation({
    summary: 'Hạch toán phiếu qua Journal Entry và link ngược journal_entry_id',
  })
  @Post(':id/post-to-journal')
  postToJournal(
    @Param('id') id: string,
    @Body() dto: CreateJournalEntryDto,
    @UserToken() token: string,
  ) {
    return this.paymentVouchersService.postToJournal(id, dto, token);
  }
}
