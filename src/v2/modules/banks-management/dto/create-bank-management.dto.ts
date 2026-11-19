import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ExtraDataField } from '@/v2/core/base-core/dto/extra-data.decorator';

export class CreateBankManagementDto {
  @ApiProperty({
    description: 'Mã ngân hàng (viết tắt)',
    maxLength: 50,
    example: 'VCB',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code: string;

  @ApiProperty({
    description: 'Tên ngắn ngân hàng',
    maxLength: 100,
    example: 'Vietcombank',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  shortName: string;

  @ApiProperty({
    description: 'Tên đầy đủ',
    maxLength: 255,
    example: 'Ngân hàng TMCP Ngoại thương Việt Nam',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({
    description: 'Mã BIN Napas',
    maxLength: 10,
    example: '970436',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  bin: string;

  @ApiPropertyOptional({
    description: 'Link ảnh logo ngân hàng',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string;

  @ApiPropertyOptional({
    description: 'Tên gọi khác / alias nhận diện',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  aliases?: string[];

  @ApiPropertyOptional({ description: 'Trạng thái hoạt động', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Có hỗ trợ chuyển khoản nhanh 24/7',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  transferSupported?: boolean;

  @ApiPropertyOptional({
    description: 'Có hỗ trợ tra cứu số tài khoản',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  lookupSupported?: boolean;

  @ExtraDataField()
  extraData?: Record<string, unknown>;
}
