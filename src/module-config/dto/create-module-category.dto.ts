import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateModuleCategoryDto {
  @ApiProperty({
    description: 'Module key identifier',
    example: 'BOM',
    default: 'BOM',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  moduleKey: string;

  @ApiProperty({ description: 'Category code', example: 'CAR' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  code: string;

  @ApiProperty({ description: 'Category name', example: 'Xe hơi' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({
    description: 'Category name (English)',
    example: 'Car',
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  nameEn?: string;

  @ApiPropertyOptional({ description: 'Description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description:
      'UUID tài khoản kế toán TK Nợ mặc định (từ erp_chart_of_accounts)',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    nullable: true,
  })
  @IsUUID()
  @IsOptional()
  defaultDebitAccountId?: string | null;

  @ApiPropertyOptional({ description: 'Is active', default: true })
  @IsOptional()
  isActive?: boolean;
}
