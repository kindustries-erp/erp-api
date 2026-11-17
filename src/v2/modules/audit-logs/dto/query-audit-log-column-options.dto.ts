import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/** Query gợi ý giá trị cho bộ lọc cột (có lọc chéo qua `filters`). */
export class QueryAuditLogColumnOptionsDto {
  @ApiPropertyOptional({ description: 'Khóa cột, ví dụ actorEmail, module' })
  @IsOptional()
  @IsString()
  column?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number = 20;

  @ApiPropertyOptional({
    description: 'JSON { cột: [giá trị] } của các cột khác',
  })
  @IsOptional()
  @IsString()
  filters?: string;
}
