import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class ExportPurchaseOrdersRangeDto {
  @ApiProperty({ description: 'Từ ngày (YYYY-MM-DD)' })
  @IsString()
  date_from: string;

  @ApiProperty({ description: 'Đến ngày (YYYY-MM-DD)' })
  @IsString()
  date_to: string;

  @ApiPropertyOptional({ description: 'Lọc theo ID nhà cung cấp (UUID)' })
  @IsOptional()
  @IsUUID()
  supplier_id?: string;

  @ApiPropertyOptional({ description: 'Lọc theo trạng thái PO' })
  @IsOptional()
  @IsString()
  status?: string;
}
