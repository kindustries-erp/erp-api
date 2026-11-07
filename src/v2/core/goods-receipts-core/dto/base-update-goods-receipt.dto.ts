import { PartialType } from '@nestjs/swagger';
import { BaseCreateGoodsReceiptDto } from './base-create-goods-receipt.dto';

export class BaseUpdateGoodsReceiptDto extends PartialType(
  BaseCreateGoodsReceiptDto,
) {}
