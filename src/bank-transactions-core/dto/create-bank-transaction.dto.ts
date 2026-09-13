import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  IsObject,
} from 'class-validator';

export class CreateBankTransactionDto {
  @ApiProperty({ enum: ['BANK', 'CASH'] })
  @IsEnum(['BANK', 'CASH'])
  sourceType: 'BANK' | 'CASH';

  @ApiProperty({ required: false })
  @IsUUID()
  @IsOptional()
  bankAccountId?: string;

  @ApiProperty({ required: false })
  @IsUUID()
  @IsOptional()
  cashBookId?: string;

  @ApiProperty()
  @IsUUID()
  branchId: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  stt?: number;

  @ApiProperty()
  @IsDateString()
  transDate: string;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  efdDate?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  referenceNumber?: string;

  @ApiProperty()
  @IsNumber()
  @Transform(({ value }) => Number(value))
  debitAmount: number;

  @ApiProperty()
  @IsNumber()
  @Transform(({ value }) => Number(value))
  creditAmount: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => (value != null ? Number(value) : value))
  balance?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  seqNo?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  accountingDescription?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  correspondentAccount?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  correspondentName?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  correspondentBank?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  importBatchId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  categoryId?: string | null;

  @ApiPropertyOptional({
    description: 'Dynamic attribute values map: attrDefId -> valueText',
  })
  @IsOptional()
  @IsObject()
  attributes?: Record<string, any>;
}
