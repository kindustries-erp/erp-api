import {
  IsString,
  IsNotEmpty,
  IsOptional,
  ValidateNested,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

class PostInvoiceLineDto {
  @IsString()
  @IsNotEmpty()
  accountId: string;

  @IsNumber()
  @Min(0)
  debit: number;

  @IsNumber()
  @Min(0)
  credit: number;

  @IsString()
  @IsOptional()
  description?: string;
}

export class PostInvoiceDto {
  @IsString()
  @IsNotEmpty()
  postingDate: string;

  @IsString()
  @IsOptional()
  documentDate?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @ValidateNested({ each: true })
  @Type(() => PostInvoiceLineDto)
  lines: PostInvoiceLineDto[];
}
