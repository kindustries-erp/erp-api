import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, IsArray } from 'class-validator';
import { BaseEntityCustomFieldsDto } from '../../module-config/dto/base-entity-custom-fields.dto';

export class CreateInventoryItemDto extends BaseEntityCustomFieldsDto {
  @ApiProperty()
  @IsString()
  sku: string;

  @ApiProperty()
  @IsString()
  itemName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  uomId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  itemTypeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({
    description: 'Code hoặc UUID của tracking policy (erp_tracking_policies)',
  })
  @IsOptional()
  @IsString()
  trackingPolicyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attributes?: string[];
}
