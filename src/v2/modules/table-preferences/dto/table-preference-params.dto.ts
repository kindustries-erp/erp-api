import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { TABLE_PREFERENCE_LIMITS } from './table-preference-limits';

export class TablePreferenceParamsDto {
  @ApiProperty({ example: 'procurement-requests-garage-table' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(TABLE_PREFERENCE_LIMITS.tableIdMax)
  tableId: string;
}
