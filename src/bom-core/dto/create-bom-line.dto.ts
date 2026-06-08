import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumberString, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateBomLineDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  componentItemId?: string;

  @ApiProperty()
  @IsNumberString()
  qtyRequired: string;

  @ApiProperty()
  @IsString()
  uom: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  scrapRate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
