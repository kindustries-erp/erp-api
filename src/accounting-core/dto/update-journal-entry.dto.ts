import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateJournalEntryLineDto {
  @ApiPropertyOptional({ description: 'ID dòng định khoản (nếu có)' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiPropertyOptional({ description: 'ID tài khoản kế toán' })
  @IsString()
  accountId: string;

  @ApiPropertyOptional({ description: 'Phát sinh Nợ' })
  @IsNumber()
  @Min(0)
  debit: number;

  @ApiPropertyOptional({ description: 'Phát sinh Có' })
  @IsNumber()
  @Min(0)
  credit: number;

  @ApiPropertyOptional({ description: 'Diễn giải dòng định khoản' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateJournalEntryDto {
  @ApiPropertyOptional({ description: 'Số chứng từ' })
  @IsOptional()
  @IsString()
  entryNo?: string;

  @ApiPropertyOptional({ description: 'Ngày hạch toán (ISO string)' })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional({ description: 'Ngày chứng từ (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  documentDate?: string;

  @ApiPropertyOptional({ description: 'Diễn giải chung của chứng từ' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Tên đối tượng liên quan' })
  @IsOptional()
  @IsString()
  subjectName?: string;

  @ApiPropertyOptional({ description: 'ID chi nhánh' })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({
    description: 'Danh sách dòng định khoản Nợ / Có',
    type: [UpdateJournalEntryLineDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateJournalEntryLineDto)
  lines?: UpdateJournalEntryLineDto[];
}
