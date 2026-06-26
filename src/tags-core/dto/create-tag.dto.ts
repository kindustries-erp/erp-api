import { IsString, IsOptional, IsHexColor, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTagDto {
  @ApiProperty({ example: 'Urgent' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ example: '#ff0000' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  color?: string;

  @ApiPropertyOptional({ example: 'Requires immediate attention' })
  @IsOptional()
  @IsString()
  description?: string;
}
