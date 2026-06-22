import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateCompanyProfileDto {
  @ApiPropertyOptional({ description: 'Tên công ty', maxLength: 255 })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  company_name?: string;

  @ApiPropertyOptional({ description: 'Mã số thuế', maxLength: 50 })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  tax_code?: string;

  @ApiPropertyOptional({ description: 'Địa chỉ công ty' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ description: 'Số điện thoại', maxLength: 50 })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  mobi_phone?: string;

  @ApiPropertyOptional({ description: 'Email công ty', maxLength: 255 })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ description: 'Ghi chú' })
  @IsString()
  @IsOptional()
  note?: string;

  @ApiPropertyOptional({ description: 'URL hoặc ID của logo' })
  @IsString()
  @IsOptional()
  logo?: string;
}
