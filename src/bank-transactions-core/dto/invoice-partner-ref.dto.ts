import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

/** Người mua/bán lấy từ hóa đơn; backend tìm hoặc tạo đối tác rồi gán cho sao kê. */
export class InvoicePartnerRefDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  taxCode?: string | null;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ enum: ['CUSTOMER', 'VENDOR'] })
  @IsIn(['CUSTOMER', 'VENDOR'])
  partnerType: 'CUSTOMER' | 'VENDOR';
}
