import type { ItemCatalogPort } from '@/v2/core/items-core';
import type { GarageItem } from './entities/garage-item.entity';
import type { GarageItemType } from './helpers/garage-item-code.helper';

/** Token cổng danh mục mã hàng garage; module khác tiêm bằng `@Inject(GARAGE_ITEM_CATALOG)`. */
export const GARAGE_ITEM_CATALOG = Symbol('GARAGE_ITEM_CATALOG');

export type GarageItemCatalog = ItemCatalogPort<GarageItem, GarageItemType>;
