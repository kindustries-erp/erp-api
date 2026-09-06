import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class QueryPurchaseOrdersDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branch_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  exclude_status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  payment_status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  invoice_status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  source_system?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  inventory_item_id?: string;

  @ApiPropertyOptional({ description: 'Lọc từ ngày (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  date_from?: string;

  @ApiPropertyOptional({ description: 'Lọc đến ngày (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  date_to?: string;

  @ApiPropertyOptional({ description: 'Lọc theo nhà cung cấp (UUID)' })
  @IsOptional()
  @IsUUID()
  supplier_id?: string;

  @ApiPropertyOptional({
    description: 'Chỉ lấy các đơn còn số lượng có thể nhập kho',
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  only_receivable?: boolean;
}
