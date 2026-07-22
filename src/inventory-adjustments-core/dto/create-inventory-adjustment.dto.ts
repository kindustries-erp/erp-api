import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateInventoryAdjustmentLineDto } from './create-inventory-adjustment-line.dto';

export class CreateInventoryAdjustmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  adjustmentNo?: string;

  @ApiProperty()
  @IsDateString()
  adjustmentDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  createdBy?: string;

  @ApiPropertyOptional({ type: [CreateInventoryAdjustmentLineDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInventoryAdjustmentLineDto)
  lines?: CreateInventoryAdjustmentLineDto[];
}
