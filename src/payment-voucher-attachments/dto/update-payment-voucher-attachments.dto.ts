import { PartialType } from '@nestjs/swagger';
import { CreatePaymentVoucherAttachmentsDto } from './create-payment-voucher-attachments.dto';

export class UpdatePaymentVoucherAttachmentsDto extends PartialType(
  CreatePaymentVoucherAttachmentsDto,
) {}
