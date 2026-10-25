import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import { CreateBankTransactionDto } from './create-bank-transaction.dto';
import { IsOptional, IsUUID } from 'class-validator';

// `description` là diễn giải gốc của ngân hàng: chỉ đọc, không cho sửa qua update
export class UpdateBankTransactionDto extends PartialType(
  OmitType(CreateBankTransactionDto, ['description'] as const),
) {
  @ApiProperty({ required: false })
  @IsUUID()
  @IsOptional()
  correspondentAccountingAccountId?: string;
}
