import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumberString, IsOptional, IsUUID } from 'class-validator';

export class CreateSalesOrderLineDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  itemId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  itemName?: string;

  @ApiProperty()
  @IsNumberString()
  qtyOrdered: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  unitPrice?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  amount?: string;
}
