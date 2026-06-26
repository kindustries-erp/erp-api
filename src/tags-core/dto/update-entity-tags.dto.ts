import { IsString, IsUUID, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateEntityTagsDto {
  @ApiProperty({ example: 'erp_purchase_orders' })
  @IsString()
  entityType: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  entityId: string;

  @ApiProperty({ type: [String], description: 'Array of Tag UUIDs' })
  @IsArray()
  @IsUUID('all', { each: true })
  tagIds: string[];
}
