import { PartialType } from '@nestjs/swagger';
import { BaseCreatePurchaseOrderDto } from './base-create-purchase-order.dto';

/** Sửa PO: mọi trường tùy chọn, không nhận status (đổi qua hành động). */
export class BaseUpdatePurchaseOrderDto extends PartialType(
  BaseCreatePurchaseOrderDto,
) {}
