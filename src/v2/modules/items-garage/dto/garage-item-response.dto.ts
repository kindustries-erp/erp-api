import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Hình dạng dữ liệu trả ra API. Không trả entity trực tiếp. */
export class GarageItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  extraData: Record<string, unknown>;

  @ApiProperty()
  itemCode: string;

  @ApiProperty()
  itemName: string;

  @ApiPropertyOptional()
  unit?: string;

  @ApiPropertyOptional()
  itemType?: string;

  @ApiProperty()
  source: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
