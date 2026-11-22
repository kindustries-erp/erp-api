import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { TABLE_PREFERENCE_LIMITS } from './table-preference-limits';

export class ListTablePreferencesDto {
  @ApiPropertyOptional({
    description: 'Chỉ trả các tableId bắt đầu bằng tiền tố này',
    example: 'procurement-',
  })
  @IsOptional()
  @IsString()
  @MaxLength(TABLE_PREFERENCE_LIMITS.tableIdPrefixMax)
  tableIdPrefix?: string;
}
