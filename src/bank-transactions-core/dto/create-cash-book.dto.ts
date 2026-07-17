import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateCashBookDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  branchId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiProperty()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  openingBalance?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  periodDate?: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  accountingAccountId: string;
}

export class UpdateCashBookDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  openingBalance?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  periodDate?: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  accountingAccountId: string;
}
