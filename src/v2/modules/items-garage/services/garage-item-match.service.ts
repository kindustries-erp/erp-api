import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AbstractItemMatchService } from '@/v2/core/items-core';
import { GarageItem } from '../entities/garage-item.entity';
import {
  GARAGE_ITEM_KIT,
  GarageItemType,
} from '../helpers/garage-item-code.helper';

/** Đối chiếu dòng hàng với danh mục garage và tạo mã còn thiếu. */
@Injectable()
export class GarageItemMatchService extends AbstractItemMatchService<
  GarageItem,
  GarageItemType
> {
  constructor(
    @InjectRepository(GarageItem)
    repo: Repository<GarageItem>,
  ) {
    super(repo, {
      ...GARAGE_ITEM_KIT,
      entity: GarageItem,
      lockKey: 'items_garage:ensure',
    });
  }
}
