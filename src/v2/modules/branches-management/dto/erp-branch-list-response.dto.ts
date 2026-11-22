import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '@/common/dto/pagination-meta.dto';
import { ErpBranchResponseDto } from './erp-branch-response.dto';

/** Response danh sách chi nhánh chuẩn v2: `items` và `pagination`. */
export class ErpBranchListResponseDto {
  @ApiProperty({ type: () => [ErpBranchResponseDto] })
  items: ErpBranchResponseDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  pagination: PaginationMetaDto;
}
