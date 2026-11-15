import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ExtraDataField } from '@/v2/core/base-core/dto/extra-data.decorator';
import { normalizeEmail } from '@/v2/core/users-core';

/** bcrypt chỉ dùng 72 byte đầu của mật khẩu, nên chặn dài hơn để tránh hiểu nhầm. */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

export class CreateUserDto {
  @ApiProperty({
    description: 'Email đăng nhập, duy nhất; server chuẩn hóa chữ thường',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeEmail(value) : value,
  )
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiProperty({
    minLength: PASSWORD_MIN_LENGTH,
    maxLength: PASSWORD_MAX_LENGTH,
  })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  password: string;

  @ApiPropertyOptional({
    description: 'Id nhân viên (erp_employees) cần liên kết',
  })
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @ExtraDataField()
  extraData?: Record<string, unknown>;
}
