import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class BaseCreateGoodsReceiptLineDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  itemCode?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  itemName: string;

  @ApiPropertyOptional({ default: 'Cái' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  @Min(0.001)
  qtyReceived: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
