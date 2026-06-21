import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumberString,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class ExecuteProductionDto {
  @ApiProperty()
  @IsUUID()
  finishedGoodItemId: string;

  @ApiProperty()
  @IsNumberString()
  qtyToProduce: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  warehouseCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  createdBy?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referenceNo?: string;

  @ApiPropertyOptional({
    description: 'Frame/engine/custom data of finished output',
  })
  @IsOptional()
  @IsObject()
  outputMetadata?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  plannedStartDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  plannedEndDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description:
      'Optional BOM id to use. If omitted, defaults to the latest ACTIVE BOM for the finished good.',
  })
  @IsOptional()
  @IsUUID()
  bomId?: string;

  @ApiPropertyOptional({
    description:
      'Per-line material overrides: replace originalItemId with alternativeItemId. Used when user selects an alternative NVL during MO creation.',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        originalItemId: { type: 'string', format: 'uuid' },
        alternativeItemId: { type: 'string', format: 'uuid' },
        notes: { type: 'string' },
      },
    },
  })
  @IsOptional()
  materialOverrides?: Array<{
    originalItemId: string;
    alternativeItemId: string;
    notes?: string;
  }>;
}
