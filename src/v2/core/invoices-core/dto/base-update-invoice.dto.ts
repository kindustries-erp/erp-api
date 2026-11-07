import { PartialType } from '@nestjs/swagger';
import { BaseCreateInvoiceDto } from './base-create-invoice.dto';

export class BaseUpdateInvoiceDto extends PartialType(BaseCreateInvoiceDto) {}
