import { PartialType } from '@nestjs/swagger';
import { CreateErpInvoiceDto } from './create-erp-invoice.dto';

export class UpdateErpInvoiceDto extends PartialType(CreateErpInvoiceDto) {}
