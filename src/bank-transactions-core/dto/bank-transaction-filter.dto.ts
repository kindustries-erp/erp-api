import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

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
  @IsString()
  @IsOptional()
  column_search?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  column_filters?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  correspondentAccount?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  correspondentName?: string;
}
