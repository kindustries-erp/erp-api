import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '@/common/dto/pagination-meta.dto';
import { EmployeeManagementResponseDto } from './employee-management-response.dto';

/** Response danh sách nhân viên chuẩn v2: `items`, `pagination`, `summaries`. */
export class EmployeeManagementListResponseDto {
  @ApiProperty({ type: () => [EmployeeManagementResponseDto] })
  items: EmployeeManagementResponseDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  pagination: PaginationMetaDto;

  @ApiProperty({ type: Object })
  summaries: Record<string, unknown>;
}
