import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ExtraDataField } from '@/v2/core/base-core/dto/extra-data.decorator';
import { GARAGE_ITEM_TYPES } from '../helpers/garage-item-code.helper';

export class CreateGarageItemDto {
  @ApiProperty({ description: 'Mã hàng, duy nhất; server chuẩn hóa chữ hoa' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(128)
  itemCode: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  itemName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  unit?: string;

  @ApiPropertyOptional({ enum: GARAGE_ITEM_TYPES })
  @IsOptional()
  @IsIn(GARAGE_ITEM_TYPES)
  itemType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ExtraDataField()
  extraData?: Record<string, unknown>;
}
