import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '@/common/dto/pagination-meta.dto';
import { BankManagementResponseDto } from './bank-management-response.dto';

/** Response danh sách ngân hàng chuẩn v2: `items` và `pagination`. */
export class BankManagementListResponseDto {
  @ApiProperty({ type: () => [BankManagementResponseDto] })
  items: BankManagementResponseDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  pagination: PaginationMetaDto;
}
