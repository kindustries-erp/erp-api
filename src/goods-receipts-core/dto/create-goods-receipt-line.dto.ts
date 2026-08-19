import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumberString, IsOptional, IsUUID } from 'class-validator';

export class CreateGoodsReceiptLineDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  purchaseOrderLineId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  itemId?: string;

  @ApiProperty()
  @IsNumberString()
  qtyReceived: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  unitCost?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  amount?: string;

  @ApiPropertyOptional()
  @IsOptional()
  declaredSerials?: Array<{
    serialNo: string;
    notes?: string | null;
    lotNo?: string | null;
    attributes?: Record<string, string> | null;
  }>;
}
