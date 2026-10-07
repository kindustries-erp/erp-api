import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class SyncAdvancedInvoiceDto {
  @ApiProperty({
    description: 'Mã số thuế doanh nghiệp đồng bộ',
    example: '0318042459',
  })
  @IsNotEmpty()
  @IsString()
  companyTaxCode: string;

  @ApiProperty({
    description: 'Phân loại hóa đơn: purchase (mua vào) hoặc sold (bán ra)',
    enum: ['purchase', 'sold'],
  })
  @IsNotEmpty()
  @IsIn(['purchase', 'sold'])
  syncType: 'purchase' | 'sold';

  @ApiPropertyOptional({
    description:
      'Hình thức hóa đơn: query (hóa đơn thường), sco-query (máy tính tiền), all',
    enum: ['query', 'sco-query', 'all'],
    default: 'all',
  })
  @IsOptional()
  @IsIn(['query', 'sco-query', 'all'])
  queryType?: 'query' | 'sco-query' | 'all';

  @ApiProperty({
    description: 'Từ ngày tra cứu (YYYY-MM-DD)',
    example: '2026-09-01',
  })
  @IsNotEmpty()
  @IsDateString()
  fromDate: string;

  @ApiProperty({
    description: 'Đến ngày tra cứu (YYYY-MM-DD)',
    example: '2026-09-30',
  })
  @IsNotEmpty()
  @IsDateString()
  toDate: string;
}
