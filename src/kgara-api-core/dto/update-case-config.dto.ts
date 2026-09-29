import {
  IsOptional,
  IsString,
  IsBoolean,
  IsUUID,
  IsObject,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BaseEntityCustomFieldsDto } from '../../module-config/dto/base-entity-custom-fields.dto';

export class UpdateCaseConfigDto extends BaseEntityCustomFieldsDto {
  @ApiPropertyOptional({
    description: 'ID danh mục phân loại vụ việc (FK -> erp_module_categories)',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @ApiPropertyOptional({
    description:
      'Mã phân loại nghiệp vụ ERP (SUA_CHUA_CHUNG, KY_GUI_NOI_BO, OJ_NGOAI, KHAC)',
    example: 'SUA_CHUA_CHUNG',
  })
  @IsOptional()
  @IsString()
  classification?: string | null;

  @ApiPropertyOptional({
    description:
      'Cờ loại trừ vụ việc khỏi báo cáo P&L xưởng, Dashboard và Lợi nhuận gộp',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  excludeFromReports?: boolean;

  @ApiPropertyOptional({
    description:
      'Cờ loại trừ vụ việc khỏi tính toán công nợ phải thu / phải chi',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  excludeFromDebt?: boolean;

  @ApiPropertyOptional({
    description: 'Ghi chú nghiệp vụ nội bộ trên ERP',
    example: 'Xe công vụ cần hoàn tất trước ngày 15',
  })
  @IsOptional()
  @IsString()
  erpNotes?: string | null;

  @ApiPropertyOptional({
    description: 'Bí danh tương thích ngược cho customAttributes',
    example: {},
  })
  @IsOptional()
  @IsObject()
  attributes?: Record<string, any>;
}
