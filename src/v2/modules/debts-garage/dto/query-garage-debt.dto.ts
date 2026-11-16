import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { TableQueryDto } from '@/common/dto/table-query.dto';

/** Tham số list công nợ garage. `page`, `pageSize`, `search`, bộ lọc cột kế thừa từ `TableQueryDto`. */
export class QueryGarageDebtDto extends TableQueryDto {
  @ApiPropertyOptional({
    description: 'Chỉ lấy khoản còn nợ (số dư > 0) hay tất cả',
    enum: ['outstanding', 'all'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['outstanding', 'all'])
  scope?: 'outstanding' | 'all';
}
