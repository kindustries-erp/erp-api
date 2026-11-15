import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { BaseCreateGoodsReceiptDto } from '@/v2/core/goods-receipts-core/dto/base-create-goods-receipt.dto';
import { CreateGarageGoodsReceiptLineDto } from './create-garage-goods-receipt-line.dto';

export class CreateGarageGoodsReceiptDto extends BaseCreateGoodsReceiptDto {
  @ApiPropertyOptional({ default: 'UNPAID' })
  @IsOptional()
  @IsIn(['UNPAID', 'PARTIALLY_PAID', 'PAID'])
  paymentStatus?: string;

  @ApiProperty({
    description:
      'Đơn mua garage nguồn (bắt buộc khi tạo). NCC, chi nhánh lấy theo đơn; tổng tiền tính từ dòng nhận',
  })
  @IsUUID()
  garageProcurementOrderId: string;

  @ApiPropertyOptional({ type: () => [CreateGarageGoodsReceiptLineDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateGarageGoodsReceiptLineDto)
  declare lines?: CreateGarageGoodsReceiptLineDto[];
}
