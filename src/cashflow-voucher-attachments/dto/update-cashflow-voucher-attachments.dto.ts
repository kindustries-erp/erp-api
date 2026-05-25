import { PartialType } from '@nestjs/swagger';
import { CreateCashflowVoucherAttachmentsDto } from './create-cashflow-voucher-attachments.dto';

export class UpdateCashflowVoucherAttachmentsDto extends PartialType(
  CreateCashflowVoucherAttachmentsDto,
) {}
