import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

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

  @ApiPropertyOptional({ description: 'Description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Is active', default: true })
  @IsOptional()
  isActive?: boolean;
}
