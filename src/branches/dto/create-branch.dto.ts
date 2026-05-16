import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBranchDto {
  @ApiProperty({ description: 'Branch Code', example: 'LEVANLUONG' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ description: 'Branch Name', example: 'Lê Văn Lương' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Address' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ description: 'Note' })
  @IsString()
  @IsOptional()
  note?: string;

  @ApiPropertyOptional({ description: 'Is Active', default: true })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}
