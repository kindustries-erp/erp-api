import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateGarageOpexDto {
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  periodYear: number;

  @IsNumber()
  @Min(1)
  @Max(12)
  @IsNotEmpty()
  @Type(() => Number)
  periodMonth: number;

  @IsString()
  @IsNotEmpty()
  categoryKey: string;

  @IsString()
  @IsNotEmpty()
  categoryName: string;

  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  amount: number;

  @IsString()
  @IsOptional()
  note?: string;
}

export class UpdateGarageOpexDto {
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  periodYear?: number;

  @IsNumber()
  @Min(1)
  @Max(12)
  @IsOptional()
  @Type(() => Number)
  periodMonth?: number;

  @IsString()
  @IsOptional()
  categoryKey?: string;

  @IsString()
  @IsOptional()
  categoryName?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  amount?: number;

  @IsString()
  @IsOptional()
  note?: string;
}

export class ListGarageOpexQueryDto {
  @IsOptional()
  @Type(() => Number)
  year?: number;

  @IsOptional()
  @Type(() => Number)
  month?: number;

  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  pageSize?: number = 20;

  @IsOptional()
  sorts?: string | string[];

  @IsOptional()
  @IsString()
  column_filters?: string;

  @IsOptional()
  @IsString()
  column_search?: string;
}
