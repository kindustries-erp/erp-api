import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { CreateBomLineDto } from './create-bom-line.dto';

export class CreateBomDto {
  @ApiProperty()
  @IsString()
  bomCode: string;

  @ApiProperty()
  @IsString()
  bomName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  finishedGoodItemId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Dynamic attribute values map: attrDefId -> valueText',
  })
  @IsOptional()
  attributes?: Record<string, string>;

  @ApiPropertyOptional({
    description:
      'Global attributes map for BOM: attrDefId or code -> valueText',
  })
  @IsOptional()
  globalAttributes?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  version?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  createdBy?: string;

  @ApiPropertyOptional({ type: [CreateBomLineDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBomLineDto)
  lines?: CreateBomLineDto[];
}
