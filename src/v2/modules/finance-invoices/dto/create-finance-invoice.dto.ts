import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, ValidateNested } from 'class-validator';
import { BaseCreateInvoiceDto } from '@/v2/core/invoices';
import { FinanceInvoiceItemDto } from './finance-invoice-item.dto';

export class CreateFinanceInvoiceDto extends BaseCreateInvoiceDto {
  @ApiPropertyOptional({ type: () => [FinanceInvoiceItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FinanceInvoiceItemDto)
  declare items?: FinanceInvoiceItemDto[];
}

export { CreateFinanceInvoiceDto as CreateInvoiceDto };
