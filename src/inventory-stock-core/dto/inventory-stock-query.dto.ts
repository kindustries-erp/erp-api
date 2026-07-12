import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class InventoryStockQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Loại item tồn kho, ví dụ RAW / FG / WIP',
  })
  @IsOptional()
  @IsString()
  item_type?: string;

  @ApiPropertyOptional({ description: 'JSON string of column searches' })
  @IsOptional()
  @IsString()
  searches?: string;

  @ApiPropertyOptional({ description: 'JSON string of column filters' })
  @IsOptional()
  @IsString()
  filters?: string;
}
