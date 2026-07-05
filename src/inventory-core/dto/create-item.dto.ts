import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, IsArray } from 'class-validator';

export class CreateInventoryItemDto {
  @ApiProperty()
  @IsString()
  sku: string;

  @ApiProperty()
  @IsString()
  itemName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  uomId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  itemTypeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({
    description: 'UUID của tracking policy (erp_tracking_policies.id)',
  })
  @IsOptional()
  @IsUUID()
  trackingPolicyId?: string;

  @ApiPropertyOptional({
    description: 'UUID của tracking category (erp_tracking_categories.id)',
  })
  @IsOptional()
  @IsUUID()
  trackingCategoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attributes?: string[];
}
