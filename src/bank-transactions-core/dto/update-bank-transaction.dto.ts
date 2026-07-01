import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateBankTransactionDto } from './create-bank-transaction.dto';
import { IsOptional, IsUUID } from 'class-validator';

export class UpdateBankTransactionDto extends PartialType(
  CreateBankTransactionDto,
) {
  @ApiProperty({ required: false })
  @IsUUID()
  @IsOptional()
  correspondentAccountingAccountId?: string;
}
