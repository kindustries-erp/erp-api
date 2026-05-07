import { PartialType } from '@nestjs/swagger';
import { CreatePaymentVoucherApprovalLogsDto } from './create-payment-voucher-approval-logs.dto';

export class UpdatePaymentVoucherApprovalLogsDto extends PartialType(
  CreatePaymentVoucherApprovalLogsDto,
) {}
