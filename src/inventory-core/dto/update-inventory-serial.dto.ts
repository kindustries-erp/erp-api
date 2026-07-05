import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateInventorySerialDto {
  @ApiPropertyOptional({ description: 'Ghi chú (notes)' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Thuộc tính mở rộng tự do dạng key-value',
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  @IsOptional()
  @IsObject()
  attributes?: Record<string, string>;
}
