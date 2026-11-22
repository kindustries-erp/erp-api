import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { TableQueryDto } from '@/common/dto/table-query.dto';

/** Tham số danh sách vụ việc theo mốc thời gian. `page`, `pageSize`, `search`, `sortOrder`, `date_from/to` kế thừa. */
export class QueryTimeHorizonCasesDto extends TableQueryDto {
  @ApiPropertyOptional({
    description:
      'Cột sắp xếp: agingDays, totalAmount, balanceAmount, completionDate, soChungTu, customerName',
  })
  @IsOptional()
  @IsString()
  sortBy?: string;
}
