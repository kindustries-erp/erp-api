import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class InventorySerialQueryDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  itemType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  trackingPolicy?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  itemId?: string;
}
