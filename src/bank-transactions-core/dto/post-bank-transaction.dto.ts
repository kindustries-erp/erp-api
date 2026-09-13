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
  IsObject,
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

  @ApiProperty({ type: [PostBankTransactionLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostBankTransactionLineDto)
  @IsNotEmpty()
  lines: PostBankTransactionLineDto[];
}
