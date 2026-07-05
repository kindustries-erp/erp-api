import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class PaginationDto {
  @ApiPropertyOptional({ default: 1, description: 'Số trang (bắt đầu từ 1)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    default: 20,
    description: 'Số lượng bản ghi trên một trang',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 20;

  @ApiPropertyOptional({
    description:
      'Trường sắp xếp, thêm dấu - ở trước để giảm dần (ví dụ: -created_at)',
  })
  @IsOptional()
  @IsString()
  sort?: string;

  @ApiPropertyOptional({ description: 'Từ khóa tìm kiếm trên Directus' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter theo loại đối tác, ví dụ CUSTOMER/VENDOR',
  })
  @IsOptional()
  @IsString()
  partnerType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notFullyIssued?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tag_id?: string;
}
