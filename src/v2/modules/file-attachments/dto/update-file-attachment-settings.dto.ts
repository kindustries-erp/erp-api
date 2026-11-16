import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

/** Trần số ngày giữ để tránh nhập nhầm (10 năm). */
export const MAX_RETENTION_DAYS = 3650;

export class UpdateFileAttachmentSettingsDto {
  @ApiPropertyOptional({ description: 'Bật/tắt tự động dọn file đã xóa mềm' })
  @IsOptional()
  @IsBoolean()
  autoPurgeEnabled?: boolean;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: MAX_RETENTION_DAYS,
    description:
      'Số ngày giữ file đã xóa mềm trước khi dọn (chỉ có tác dụng khi bật)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_RETENTION_DAYS)
  retentionDays?: number;
}

export class FileAttachmentSettingsResponseDto {
  autoPurgeEnabled: boolean;
  retentionDays: number;
  updatedBy: string | null;
  updatedAt: Date;
}
