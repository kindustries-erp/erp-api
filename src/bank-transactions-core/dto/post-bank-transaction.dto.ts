import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class PostBankTransactionLineDto {
  @ApiProperty()
  @IsUUID()
  accountId: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  debit: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  credit: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class PostBankTransactionDto {
  @ApiProperty()
  @IsDateString()
  postingDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ type: [PostBankTransactionLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostBankTransactionLineDto)
  @IsNotEmpty()
  lines: PostBankTransactionLineDto[];
}
