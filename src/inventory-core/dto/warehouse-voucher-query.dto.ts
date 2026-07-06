import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class WarehouseVoucherQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Loại chứng từ: all, receipt, issue' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: 'Từ ngày (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Đến ngày (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  dateTo?: string;

  @ApiPropertyOptional({ description: 'ID đối tác (Khách hàng / NCC)' })
  @IsOptional()
  @IsString()
  partnerId?: string;
}
