import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '@/common/dto/pagination.dto';

export class QueryLoanDto extends PaginationDto {
  @IsOptional()
  @IsString()
  lenderName?: string;
}
