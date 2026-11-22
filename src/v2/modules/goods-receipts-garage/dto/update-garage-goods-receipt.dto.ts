import { PartialType } from '@nestjs/swagger';
import { CreateGarageGoodsReceiptDto } from './create-garage-goods-receipt.dto';

export class UpdateGarageGoodsReceiptDto extends PartialType(
  CreateGarageGoodsReceiptDto,
) {}
