import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  Allow,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

function transformJsonParam(value: any): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return undefined;
    }
  }
  return typeof value === 'string' ? value : String(value);
}

function transformSortsParam(value: any): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    if (value.startsWith('[') && value.endsWith(']')) {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
    return [value];
  }
  return undefined;
}

export class BankTransactionFilterDto {
  @ApiProperty({ required: false, type: [String] })
  @Transform(({ value }) =>
    value === undefined ? undefined : Array.isArray(value) ? value : [value],
  )
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tagIds?: string[];
  @ApiProperty({ required: false })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  @Min(1)
  page?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  @Min(1)
  pageSize?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiProperty({ enum: ['BANK', 'CASH'], required: false })
  @IsEnum(['BANK', 'CASH'])
  @IsOptional()
  sourceType?: 'BANK' | 'CASH';

  @ApiProperty({ required: false })
  @IsUUID()
  @IsOptional()
  branchId?: string;

  @ApiProperty({ required: false })
  @IsUUID()
  @IsOptional()
  bankAccountId?: string;

  @ApiProperty({ required: false })
  @IsUUID()
  @IsOptional()
  cashBookId?: string;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  sortBy?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  sortOrder?: 'ASC' | 'DESC';

  @ApiProperty({ required: false, enum: ['IN', 'OUT'] })
  @IsEnum(['IN', 'OUT'])
  @IsOptional()
  transactionType?: 'IN' | 'OUT';

  @ApiProperty({ required: false })
  @Transform(({ value }) => transformJsonParam(value))
  @IsOptional()
  @Allow()
  column_search?: any;

  @ApiProperty({ required: false })
  @Transform(({ value }) => transformJsonParam(value))
  @IsOptional()
  @Allow()
  columnSearch?: any;

  @ApiProperty({ required: false })
  @Transform(({ value }) => transformJsonParam(value))
  @IsOptional()
  @Allow()
  column_filters?: any;

  @ApiProperty({ required: false })
  @Transform(({ value }) => transformJsonParam(value))
  @IsOptional()
  @Allow()
  columnFilters?: any;

  @ApiProperty({ required: false, type: [String] })
  @Transform(({ value }) => transformSortsParam(value))
  @IsArray()
  @IsOptional()
  sorts?: string[];

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  correspondentAccount?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  correspondentName?: string;
}
