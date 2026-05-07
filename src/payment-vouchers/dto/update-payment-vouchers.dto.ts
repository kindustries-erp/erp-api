import { PartialType } from '@nestjs/swagger';
import { CreatePaymentVouchersDto } from './create-payment-vouchers.dto';

export class UpdatePaymentVouchersDto extends PartialType(
  CreatePaymentVouchersDto,
) {}
