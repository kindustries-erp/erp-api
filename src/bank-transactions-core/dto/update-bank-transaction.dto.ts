import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsOptional,
  IsUUID,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { CreateBankTransactionDto } from './create-bank-transaction.dto';
import { InvoicePartnerRefDto } from './invoice-partner-ref.dto';

// `description` là diễn giải gốc của ngân hàng: chỉ đọc, không cho sửa qua update
export class UpdateBankTransactionDto extends PartialType(
  OmitType(CreateBankTransactionDto, ['description'] as const),
) {
  @ApiProperty({ required: false })
  @IsUUID()
  @IsOptional()
  correspondentAccountingAccountId?: string;

  /** Đối tượng đã có trong danh mục; null để bỏ đối tượng. */
  @ApiPropertyOptional({ nullable: true })
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  @IsOptional()
  partnerId?: string | null;

  /** Người mua/bán từ hóa đơn chưa có trong danh mục; backend tạo đối tác rồi gán. */
  @ApiPropertyOptional({ type: () => InvoicePartnerRefDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => InvoicePartnerRefDto)
  invoicePartner?: InvoicePartnerRefDto;
}
