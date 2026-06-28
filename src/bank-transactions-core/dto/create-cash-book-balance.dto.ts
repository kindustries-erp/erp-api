import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateCashBookBalanceDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  cashBookId: string;

  @ApiProperty()
  @IsDateString()
  @IsNotEmpty()
  periodDate: string;

  @ApiProperty()
  @IsNumber()
  @Transform(({ value }) => Number(value))
  openingBalance: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  note?: string;
}

export class UpdateCashBookBalanceDto {
  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  periodDate?: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => Number(value))
  openingBalance?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  note?: string;
}
