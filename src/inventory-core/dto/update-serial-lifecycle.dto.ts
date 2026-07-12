import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdateSerialLifecycleDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  customerName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  customerPhone?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  customerAddress?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  customerIdNumber?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  warrantyActivatedAt?: string;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  warrantyMonths?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  dealerName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  dealerId?: string;
}
