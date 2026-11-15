import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { ExtraDataField } from '@/v2/core/base-core/dto/extra-data.decorator';
import { USER_STATUSES } from '@/v2/core/users-core';

/** Cập nhật tài khoản. Email và mật khẩu không đổi qua đây (có endpoint riêng cho mật khẩu). */
export class UpdateUserDto {
  @ApiPropertyOptional({ enum: USER_STATUSES })
  @IsOptional()
  @IsIn(USER_STATUSES)
  status?: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Id nhân viên cần liên kết; null để gỡ liên kết',
  })
  @IsOptional()
  @IsUUID()
  employeeId?: string | null;

  @ExtraDataField()
  extraData?: Record<string, unknown>;
}
