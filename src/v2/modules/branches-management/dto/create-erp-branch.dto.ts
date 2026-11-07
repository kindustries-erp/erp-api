import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

// Body của POST /api/v1/branches. Không dùng trực tiếp làm @Body() vì
// ValidationPipe toàn cục có forbidNonWhitelisted; xem ParseBranchBodyPipe.
export class CreateErpBranchDto {
  @ApiProperty({ maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  code: string;

  @ApiProperty({ maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ default: true })
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  is_active?: boolean;
}

// Type đầu vào cho tầng service/facade (giữ permissive để không đổi contract runtime).
export type CreateErpBranchInput = Record<string, unknown> & {
  code?: unknown;
  name?: unknown;
  is_active?: unknown;
};

export type UpdateErpBranchInput = CreateErpBranchInput;
