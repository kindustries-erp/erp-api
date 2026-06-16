import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class ListBomDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter theo thành phẩm' })
  @IsOptional()
  @IsString()
  finishedGoodItemId?: string;
}
