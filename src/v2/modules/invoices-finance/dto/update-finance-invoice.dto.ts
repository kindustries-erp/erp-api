import { PartialType } from '@nestjs/swagger';
import { CreateFinanceInvoiceDto } from './create-finance-invoice.dto';

export class UpdateFinanceInvoiceDto extends PartialType(
  CreateFinanceInvoiceDto,
) {}

export { UpdateFinanceInvoiceDto as UpdateInvoiceDto };
