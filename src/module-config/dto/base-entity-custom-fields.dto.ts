import { IsOptional, IsObject } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class BaseEntityCustomFieldsDto {
  @ApiPropertyOptional({
    description:
      'Dữ liệu thuộc tính tùy chỉnh & mặc định hệ thống (Key: attr_def_id hoặc code)',
    example: {
      category: 'PO',
      custom_project_code: 'DA-2026',
    },
  })
  @IsOptional()
  @IsObject()
  customAttributes?: Record<string, any>;
}
