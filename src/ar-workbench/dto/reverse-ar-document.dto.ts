import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsObject, IsOptional, IsString } from 'class-validator';

export class ReverseArDocumentDto {
  @ApiPropertyOptional({
    description: 'Reversal posting date. Defaults to today.',
  })
  @IsOptional()
  @IsDateString()
  posting_date?: string;

  @ApiPropertyOptional({
    description: 'Business reason / approval note for immutable reversal.',
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
