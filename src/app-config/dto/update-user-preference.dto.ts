import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateUserPreferenceDto {
  @ApiPropertyOptional({
    description: 'Giao diện ứng dụng (classic, shell, orcaq, midnight)',
    example: 'classic',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  theme?: string;

  @ApiPropertyOptional({
    description: 'Ngôn ngữ ứng dụng (vi, en)',
    example: 'vi',
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  @ApiPropertyOptional({
    description: 'Cấu hình cột và hiển thị của các bảng dữ liệu theo tableId',
    example: {
      'purchase-orders-list': {
        columnOrder: ['poNumber', 'vendor', 'status'],
        columnVisibility: { notes: false },
        columnSizing: { poNumber: 150 },
      },
    },
  })
  @IsOptional()
  @IsObject()
  tableConfigs?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Cấu hình giao diện bổ sung khác (sidebar, drawer, v.v.)',
    example: { sidebarCollapsed: false },
  })
  @IsOptional()
  @IsObject()
  uiConfigs?: Record<string, any>;
}
