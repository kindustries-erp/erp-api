import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserToken } from '../common/decorators/user-token.decorator';
import { DirectusAuthGuard } from '../auth/guards/directus-auth.guard';
import { ArWorkbenchService } from './ar-workbench.service';
import { ArWorkbenchQueryDto } from './dto/ar-workbench-query.dto';
import { CreateArDocumentDto } from './dto/create-ar-document.dto';
import { UpdateArDocumentDto } from './dto/update-ar-document.dto';
import { CreateArApplicationDto } from './dto/create-ar-application.dto';
import { CreateArCollectionActivityDto } from './dto/create-ar-collection-activity.dto';
import { CreateArSalesInvoiceDto } from './dto/create-ar-sales-invoice.dto';
import { ReverseArDocumentDto } from './dto/reverse-ar-document.dto';
import { CreatePaymentReceiptDto } from './dto/create-payment-receipt.dto';
import { CreateCustomerAdvanceDto } from './dto/create-customer-advance.dto';
import { ApplyAdvanceToInvoiceDto } from './dto/apply-advance-to-invoice.dto';

@ApiTags('AR Workbench')
@ApiBearerAuth()
@Controller('ar-workbench')
@UseGuards(DirectusAuthGuard)
export class ArWorkbenchController {
  constructor(private readonly service: ArWorkbenchService) {}

  @ApiOperation({ summary: 'AR production use-case coverage matrix' })
  @Get('coverage')
  getCoverage() {
    return this.service.getCoverage();
  }

  @ApiOperation({ summary: 'AR workbench summary' })
  @Get('summary')
  getSummary(@Query() query: ArWorkbenchQueryDto, @UserToken() token: string) {
    return this.service.getSummary(query, token);
  }

  @Get('documents')
  findDocuments(
    @Query() query: ArWorkbenchQueryDto,
    @UserToken() token: string,
  ) {
    return this.service.findDocuments(query, token);
  }

  @Post('documents')
  createDocument(@Body() dto: CreateArDocumentDto, @UserToken() token: string) {
    return this.service.createDocument(dto, token);
  }

  @ApiOperation({ summary: 'Create draft AR sales invoice with lines' })
  @Post('sales-invoices')
  createSalesInvoice(
    @Body() dto: CreateArSalesInvoiceDto,
    @UserToken() token: string,
  ) {
    return this.service.createSalesInvoice(dto, token);
  }

  @ApiOperation({ summary: 'Post AR invoice and generate journal entry' })
  @Post('documents/:id/post')
  postDocument(@Param('id') id: string, @UserToken() token: string) {
    return this.service.postDocument(id, token);
  }

  @ApiOperation({
    summary: 'Reverse posted AR invoice with immutable reversal journal entry',
  })
  @Post('documents/:id/reverse')
  reverseDocument(
    @Param('id') id: string,
    @Body() dto: ReverseArDocumentDto,
    @UserToken() token: string,
  ) {
    return this.service.reverseDocument(id, dto, token);
  }

  @Patch('documents/:id')
  updateDocument(
    @Param('id') id: string,
    @Body() dto: UpdateArDocumentDto,
    @UserToken() token: string,
  ) {
    return this.service.updateDocument(id, dto, token);
  }

  @Get('applications')
  findApplications(
    @Query() query: ArWorkbenchQueryDto,
    @UserToken() token: string,
  ) {
    return this.service.findApplications(query, token);
  }

  @Post('applications')
  createApplication(
    @Body() dto: CreateArApplicationDto,
    @UserToken() token: string,
  ) {
    return this.service.createApplication(dto, token);
  }

  @Get('collection-activities')
  findCollectionActivities(
    @Query() query: ArWorkbenchQueryDto,
    @UserToken() token: string,
  ) {
    return this.service.findCollectionActivities(query, token);
  }

  @Post('collection-activities')
  createCollectionActivity(
    @Body() dto: CreateArCollectionActivityDto,
    @UserToken() token: string,
  ) {
    return this.service.createCollectionActivity(dto, token);
  }

  // ─── Payment Receipts ────────────────────────────────────────────────────

  @Get('payment-vouchers')
  @ApiOperation({ summary: 'Danh sách phiếu thu (payment_vouchers direction=RECEIPT)' })
  findPaymentVouchers(
    @Query() query: ArWorkbenchQueryDto,
    @UserToken() token: string,
  ) {
    return this.service.findPaymentVouchers(query, token);
  }

  @Post('payment-vouchers')
  @ApiOperation({ summary: 'Tạo phiếu thu DRAFT (UC#2,#37,#38,#39)' })
  createPaymentReceipt(
    @Body() dto: CreatePaymentReceiptDto,
    @UserToken() token: string,
  ) {
    return this.service.createPaymentReceipt(dto, token);
  }

  @Post('payment-vouchers/:id/post')
  @ApiOperation({ summary: 'Post phiếu thu → sinh JE N111/112 C131' })
  postPaymentVoucher(@Param('id') id: string, @UserToken() token: string) {
    return this.service.postPaymentVoucher(id, token);
  }

  @Post('payment-vouchers/:id/allocate')
  @ApiOperation({ summary: 'Allocate phiếu thu vào invoice(s) (UC#5,#6,#7,#8)' })
  allocatePayment(
    @Param('id') id: string,
    @Body()
    body: {
      allocations: {
        target_document_id: string;
        amount: number;
        writeoff_amount?: number;
        writeoff_account_id?: string;
        reason?: string;
      }[];
    },
    @UserToken() token: string,
  ) {
    return this.service.allocatePayment(id, body.allocations, token);
  }

  @Post('payment-vouchers/:id/reverse')
  @ApiOperation({ summary: 'Reverse phiếu thu đã POSTED (UC#31)' })
  reversePaymentVoucher(
    @Param('id') id: string,
    @Body() body: { reason?: string; posting_date?: string },
    @UserToken() token: string,
  ) {
    return this.service.reversePaymentVoucher(id, body, token);
  }

  // ─── Customer Advances / Deposits ────────────────────────────────────────

  @Get('customer-advances')
  @ApiOperation({ summary: 'Danh sách tiền khách đặt cọc trước (UC#3)' })
  findCustomerAdvances(
    @Query() query: ArWorkbenchQueryDto,
    @UserToken() token: string,
  ) {
    return this.service.findCustomerAdvances(query, token);
  }

  @Post('customer-advances')
  @ApiOperation({ summary: 'Tạo phiếu đặt cọc khách hàng DRAFT (UC#3)' })
  createCustomerAdvance(
    @Body() dto: CreateCustomerAdvanceDto,
    @UserToken() token: string,
  ) {
    return this.service.createCustomerAdvance(dto, token);
  }

  @Post('customer-advances/:id/post')
  @ApiOperation({ summary: 'Post phiếu đặt cọc → sinh JE N111/112/113 C131 advance' })
  postCustomerAdvance(@Param('id') id: string, @UserToken() token: string) {
    return this.service.postCustomerAdvance(id, token);
  }

  @Post('customer-advances/:id/reverse')
  @ApiOperation({ summary: 'Reverse phiếu đặt cọc đã POSTED (immutable reversal JE)' })
  reverseCustomerAdvance(
    @Param('id') id: string,
    @Body() body: { reason?: string; posting_date?: string },
    @UserToken() token: string,
  ) {
    return this.service.reverseCustomerAdvance(id, body, token);
  }

  // ─── UC#4 Apply Advance to Invoice / Cấn trừ cọc ────────────────────────────

  @Get('advance-applications')
  @ApiOperation({ summary: 'Danh sách cấn trừ cọc (ADVANCE_APPLICATION records) — UC#4' })
  findAdvanceApplications(
    @Query() query: { advance_voucher_id?: string; ar_document_id?: string; page?: number; pageSize?: number },
    @UserToken() token: string,
  ) {
    return this.service.findAdvanceApplications(query, token);
  }

  @Post('advance-applications')
  @ApiOperation({ summary: 'Cấn trừ tiền cọc vào invoice — UC#4 (N131-advance/C131-invoice internal settlement)' })
  applyAdvanceToInvoice(
    @Body() dto: ApplyAdvanceToInvoiceDto,
    @UserToken() token: string,
  ) {
    return this.service.applyAdvanceToInvoice(dto, token);
  }

  @Post('advance-applications/:id/reverse')
  @ApiOperation({ summary: 'Hủy cấn trừ cọc — khôi phục số dư advance và open_amount invoice' })
  reverseAdvanceApplication(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @UserToken() token: string,
  ) {
    return this.service.reverseAdvanceApplication(id, body, token);
  }
}

