import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { TableQueryDto } from '@/common/dto/table-query.dto';

export class BaseQueryInvoiceDto extends TableQueryDto {
  @ApiPropertyOptional({ enum: ['IN', 'OUT'] })
  @IsOptional()
  @IsIn(['IN', 'OUT'])
  direction?: string;

  @ApiPropertyOptional({ description: 'MST đối tác (bán hoặc mua)' })
  @IsOptional()
  @IsString()
  partner_tax_code?: string;
}
