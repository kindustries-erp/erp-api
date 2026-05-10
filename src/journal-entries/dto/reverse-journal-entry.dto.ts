import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ReverseJournalEntryDto {
  @ApiPropertyOptional({ description: 'Lý do đảo bút toán' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({
    description: 'Ngày đảo bút toán (mặc định = hôm nay)',
    example: '2026-01-31',
  })
  @IsOptional()
  @IsString()
  reverse_date?: string;
}
