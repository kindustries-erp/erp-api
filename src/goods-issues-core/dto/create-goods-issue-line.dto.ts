import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumberString, IsOptional, IsUUID } from 'class-validator';

export class CreateGoodsIssueLineDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  salesOrderLineId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  itemId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  serialId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @ApiProperty()
  @IsNumberString()
  qtyIssued: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  unitCost?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  amount?: string;
}
