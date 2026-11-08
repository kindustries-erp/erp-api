import { ApiProperty } from '@nestjs/swagger';

/** Khối `pagination` của response danh sách chuẩn v2. */
export class PaginationMetaDto {
  @ApiProperty({ description: 'Trang hiện tại (bắt đầu từ 1)', example: 1 })
  page: number;

  @ApiProperty({ description: 'Số dòng trên một trang', example: 20 })
  pageSize: number;

  @ApiProperty({ description: 'Tổng số dòng khớp bộ lọc', example: 125 })
  total: number;

  @ApiProperty({
    description: 'Tổng số trang (tối thiểu 1)',
    example: 7,
  })
  totalPages: number;
}
