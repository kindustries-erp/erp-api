import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ExtraDataField } from '@/v2/core/base-core/dto/extra-data.decorator';

export class ProcurementRequestLineDto {
  @ApiProperty({ enum: ['GOODS', 'SERVICE'] })
  @IsIn(['GOODS', 'SERVICE'])
  lineType: 'GOODS' | 'SERVICE';

  @ApiPropertyOptional() @IsOptional() @IsUUID() itemId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  itemCode?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  itemName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  qtyRequested: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  estUnitPrice?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;

  @ExtraDataField()
  extraData?: Record<string, unknown>;
}

export class CreateProcurementRequestDto {
  @ApiProperty() @IsDateString() requestDate: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() neededDate?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() requesterEmployeeId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() remarks?: string;

  @ExtraDataField()
  extraData?: Record<string, unknown>;

  @ApiProperty({ type: [ProcurementRequestLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProcurementRequestLineDto)
  lines: ProcurementRequestLineDto[];
}

export class ReplaceRequestLinesDto {
  @ApiProperty({ type: [ProcurementRequestLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProcurementRequestLineDto)
  lines: ProcurementRequestLineDto[];
}

export class ListProcurementRequestsDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number = 20;
}

export class ReasonBodyDto {
  @ApiProperty({ maxLength: 500 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}
