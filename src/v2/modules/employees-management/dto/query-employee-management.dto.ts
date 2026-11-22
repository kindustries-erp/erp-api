import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { TableQueryDto } from '@/common/dto/table-query.dto';

/** `status` (ACTIVE/INACTIVE) đã có sẵn trong `PaginationDto`. */
export class QueryEmployeeManagementDto extends TableQueryDto {
  @ApiPropertyOptional({ description: 'Lọc theo chi nhánh' })
  @IsOptional()
  @IsUUID()
  branchId?: string;
}
