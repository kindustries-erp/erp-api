import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ListAttachmentsDto {
  @ApiPropertyOptional({ description: 'Trang hiện tại (1-based)' })
  @IsOptional()
  @IsString()
  page?: string;

  @ApiPropertyOptional({ description: 'Kích thước trang' })
  @IsOptional()
  @IsString()
  pageSize?: string;

  @ApiPropertyOptional({ description: 'Từ khóa tìm kiếm tên file' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Loại tài liệu' })
  @IsOptional()
  @IsString()
  document_type?: string;

  @ApiPropertyOptional({ description: 'Từ ngày YYYY-MM-DD' })
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Đến ngày YYYY-MM-DD' })
  @IsOptional()
  @IsString()
  dateTo?: string;

  @ApiPropertyOptional({ description: 'Chuỗi JSON bộ lọc nâng cao' })
  @IsOptional()
  @IsString()
  filtersStr?: string;

  @ApiPropertyOptional({ description: 'Cột sắp xếp' })
  @IsOptional()
  @IsString()
  sort?: string;
}

export class AttachmentColumnOptionsDto {
  @ApiPropertyOptional({ description: 'Tên cột lọc' })
  @IsOptional()
  @IsString()
  column?: string;

  @ApiPropertyOptional({ description: 'Từ khóa tìm kiếm trong options' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Trang options (1-based)' })
  @IsOptional()
  @IsString()
  page?: string;

  @ApiPropertyOptional({ description: 'Kích thước trang options' })
  @IsOptional()
  @IsString()
  pageSize?: string;

  @ApiPropertyOptional({ description: 'Chuỗi JSON bộ lọc kết hợp' })
  @IsOptional()
  @IsString()
  column_filters?: string;
}
