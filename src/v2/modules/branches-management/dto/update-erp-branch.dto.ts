import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ExtraDataField } from '@/v2/core/base-core/dto/extra-data.decorator';

// Body của PATCH /api/v2/branches/:id: mọi field tùy chọn, nhưng nếu có mặt thì phải hợp lệ
// (null cũng bị từ chối, vì legacy sẽ lỗi NOT NULL ở DB).
export class UpdateErpBranchDto {
  @ApiPropertyOptional({ maxLength: 100 })
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  code?: string;

  @ApiPropertyOptional({ maxLength: 255 })
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional()
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  is_active?: boolean;

  @ExtraDataField()
  extraData?: Record<string, unknown>;
}
