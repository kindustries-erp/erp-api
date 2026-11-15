import { Injectable } from '@nestjs/common';
import { AbstractLineItemResolver } from '@/v2/core/items-core';
import type { GarageItem } from '../entities/garage-item.entity';
import type { GarageItemType } from '../helpers/garage-item-code.helper';
import { GarageItemMatchService } from './garage-item-match.service';

/**
 * Chuẩn hóa mã hàng cho dòng chứng từ garage (PR, PO, nhận hàng, phiếu kho) theo danh mục `items_garage`.
 * Module garage khác tiêm class này và gọi `resolveLines` trong transaction ghi dòng.
 */
@Injectable()
export class GarageLineItemResolver extends AbstractLineItemResolver<
  GarageItem,
  GarageItemType
> {
  constructor(items: GarageItemMatchService) {
    super(items);
  }
}
