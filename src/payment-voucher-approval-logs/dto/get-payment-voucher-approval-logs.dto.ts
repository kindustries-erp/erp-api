import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class GetPaymentVoucherApprovalLogsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'ID của phiếu thu chi' })
  @IsOptional()
  @IsUUID()
  payment_voucher_id?: string;
}
