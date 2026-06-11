import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class InventoryMasterQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Lọc theo active/inactive. Bỏ trống để lấy tất cả.',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}
