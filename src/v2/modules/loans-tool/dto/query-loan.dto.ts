import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { TableQueryDto } from '@/common/dto/table-query.dto';

export class QueryLoanDto extends TableQueryDto {
  @ApiPropertyOptional({ description: 'Lọc theo ngân hàng / đơn vị cho vay' })
  @IsOptional()
  @IsString()
  lenderName?: string;

  @ApiPropertyOptional({
    enum: ['only'],
    description:
      'only: chỉ liệt kê khoản vay đã xóa mềm (cần quyền purge để xóa vĩnh viễn)',
  })
  @IsOptional()
  @IsIn(['only'])
  deleted?: 'only';
}
