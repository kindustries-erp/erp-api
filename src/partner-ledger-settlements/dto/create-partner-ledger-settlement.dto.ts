import {
  IsString,
  IsOptional,
  IsNumber,
  IsUUID,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePartnerLedgerSettlementDto {
  @ApiProperty() @IsUUID() @IsNotEmpty() partner_ledger_item_id: string;

  @ApiProperty() @IsUUID() @IsNotEmpty() payment_voucher_id: string;

  @ApiProperty({ example: '2026-01-15' })
  @IsString()
  @IsNotEmpty()
  settlement_date: string;

  @ApiProperty() @IsNumber() amount: number;

  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}
