import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { TableQueryDto } from '@/common/dto/table-query.dto';

/** Tham số list sổ nợ garage; `page`, `pageSize`, `search`, bộ lọc cột kế thừa từ `TableQueryDto` (`status` có sẵn ở `PaginationDto`, service chỉ nhận OPEN/SETTLED/VOID). */
export class QueryDebtLedgerDto extends TableQueryDto {
  @ApiPropertyOptional({ enum: ['RECEIVABLE', 'PAYABLE'] })
  @IsOptional()
  @IsIn(['RECEIVABLE', 'PAYABLE'])
  direction?: 'RECEIVABLE' | 'PAYABLE';

  @ApiPropertyOptional({ enum: ['CUSTOMER', 'INSURER', 'SUPPLIER'] })
  @IsOptional()
  @IsIn(['CUSTOMER', 'INSURER', 'SUPPLIER'])
  partyType?: string;

  @ApiPropertyOptional({ description: 'Chỉ khoản nợ của vụ việc này' })
  @IsOptional()
  @IsUUID()
  caseId?: string;
}
