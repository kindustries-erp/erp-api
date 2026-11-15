import type { ItemLookupLine, ItemMatch } from '@/v2/core/items-core';
import type { GarageItem } from '../entities/garage-item.entity';
import type { GarageItemType } from './garage-item-code.helper';

/** Một dòng hàng cần đối chiếu với danh mục garage. */
export type GarageItemLookupLine = ItemLookupLine;

/** Kết quả đối chiếu một dòng hàng với danh mục garage. */
export type GarageItemMatch = ItemMatch<GarageItem, GarageItemType>;
