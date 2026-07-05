import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class InventoryItemQueryDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  itemTypeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ids?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  attributes?: string;
}
