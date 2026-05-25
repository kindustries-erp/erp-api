import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class GetCashflowVoucherAttachmentsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'ID của phiếu thu chi dòng tiền' })
  @IsOptional()
  @IsUUID()
  cashflow_voucher_id?: string;
}
