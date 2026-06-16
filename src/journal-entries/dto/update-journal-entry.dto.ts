import {
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateJournalEntryLineDto {
  @IsOptional()
  @IsUUID()
  id?: string; // If provided, update existing. If not, maybe we create or error. The requirement says "chỉ cho phép cập nhật mảng lines với tài khoản và diễn giải". So ID is required to map.

  @IsOptional()
  @IsString()
  account_id?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateJournalEntryDto {
  @ApiPropertyOptional({ description: 'Diễn giải chung' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Danh sách dòng cần update (tài khoản, diễn giải)',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateJournalEntryLineDto)
  lines?: UpdateJournalEntryLineDto[];
}
