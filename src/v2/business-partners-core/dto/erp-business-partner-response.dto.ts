import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Hình dạng dữ liệu trả ra API. Không trả entity trực tiếp. */
export class ErpBusinessPartnerResponseDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional()
  code?: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  displayName?: string;

  @ApiProperty()
  partnerType: string;

  @ApiPropertyOptional()
  taxCode?: string;

  @ApiPropertyOptional()
  phone?: string;

  @ApiPropertyOptional()
  email?: string;

  @ApiPropertyOptional()
  address?: string;

  @ApiPropertyOptional()
  contactName?: string;

  @ApiPropertyOptional()
  status?: string;

  @ApiPropertyOptional()
  notes?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
