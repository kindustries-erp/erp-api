import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateArCollectionActivityDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ar_document_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  business_partner_id?: string;

  @ApiProperty({
    enum: [
      'REMINDER',
      'CALL',
      'EMAIL',
      'DISPUTE',
      'PROMISE_TO_PAY',
      'ESCALATION',
      'LEGAL_CASE',
      'BAD_DEBT_REVIEW',
    ],
  })
  @IsIn([
    'REMINDER',
    'CALL',
    'EMAIL',
    'DISPUTE',
    'PROMISE_TO_PAY',
    'ESCALATION',
    'LEGAL_CASE',
    'BAD_DEBT_REVIEW',
  ])
  activity_type!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  activity_date?: string;

  @ApiPropertyOptional({ enum: ['OPEN', 'DONE', 'CANCELLED'], default: 'OPEN' })
  @IsOptional()
  @IsIn(['OPEN', 'DONE', 'CANCELLED'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  owner_user_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  promise_to_pay_date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiPropertyOptional({ default: '' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  next_action_at?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
