import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { CaseOrigin } from '../entities/case-garage.enums';
import { TableQueryDto } from '@/common/dto/table-query.dto';

/**
 * Tham số list vụ việc, hạng mục dịch vụ và báo cáo lãi gộp.
 * `page`, `pageSize`, `search`, `sort` (`a,-b`), `column_filters` (JSON), `date_from/date_to`,
 * `summary_keys` kế thừa từ `TableQueryDto`.
 */
export class QueryCasesGarageDto extends TableQueryDto {
  @ApiPropertyOptional({
    description:
      'Loại sản phẩm của hạng mục (chỉ dùng cho `services`); `ALL` = tất cả',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  serviceType?: string;

  @ApiPropertyOptional({
    enum: CaseOrigin,
    description: 'Lọc theo nguồn: NATIVE hoặc KGARA_SYNC',
  })
  @IsOptional()
  @IsEnum(CaseOrigin)
  origin?: CaseOrigin;
}
