import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { TableQueryDto } from '@/common/dto/table-query.dto';
import {
  GARAGE_OVERDUE_BUCKETS,
  type GarageOverdueBucket,
} from '@/kgara-api-core/helpers/garage-cashflow-overdue.helper';

/** Tham số list phiếu thu chi garage; `status` có sẵn ở `PaginationDto`, service chỉ nhận trạng thái hợp lệ. */
export class QueryCashflowVoucherGarageDto extends TableQueryDto {
  @ApiPropertyOptional({ enum: ['RECEIPT', 'PAYMENT'] })
  @IsOptional()
  @IsIn(['RECEIPT', 'PAYMENT'])
  voucherType?: 'RECEIPT' | 'PAYMENT';

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  caseId?: string;

  @ApiPropertyOptional({
    enum: GARAGE_OVERDUE_BUCKETS,
    description: 'Nhóm quá hạn, chỉ gồm phiếu dự thu / dự chi',
  })
  @IsOptional()
  @IsIn(GARAGE_OVERDUE_BUCKETS)
  overdueBucket?: GarageOverdueBucket;
}

/** Tham số `duplicate-check`: cùng số tiền, gần ngày, cùng vụ việc hoặc cùng biển số. */
export class CheckCashflowDuplicateGarageDto {
  @ApiPropertyOptional()
  @Type(() => Number)
  @IsNumber()
  amount: number;

  @ApiPropertyOptional({ description: 'YYYY-MM-DD, mặc định hôm nay' })
  @IsOptional()
  @IsString()
  transDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  licensePlate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  caseId?: string;

  @ApiPropertyOptional({ description: 'Bỏ qua phiếu này (khi đang sửa)' })
  @IsOptional()
  @IsUUID()
  excludeId?: string;
}
