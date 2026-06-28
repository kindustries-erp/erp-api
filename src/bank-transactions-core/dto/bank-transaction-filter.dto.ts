import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class BankTransactionFilterDto {
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

  @ApiProperty({ enum: ['BANK', 'CASH'] })
  @IsEnum(['BANK', 'CASH'])
  sourceType: 'BANK' | 'CASH';

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
}
