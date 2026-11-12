import type { EntityManager } from 'typeorm';

/** Nguồn tạo của một mã trong danh mục. */
export const ITEM_SOURCES = ['SEED', 'AI', 'MANUAL'] as const;
export type ItemSource = (typeof ITEM_SOURCES)[number];

/** Một dòng hàng cần đối chiếu với danh mục. */
export interface ItemLookupLine {
  itemCode?: string | null;
  itemName: string;
  unit?: string | null;
  itemType?: string | null;
}

/** Kết quả đối chiếu một dòng hàng với danh mục. */
export interface ItemMatch<TItem, TType extends string = string> {
  status: 'MATCHED' | 'NEW';
  matchedBy?: 'CODE' | 'NAME';
  item?: TItem;
  /** Mã đề xuất cho dòng NEW khi chứng từ có mã gốc; không có thì sinh số lúc tạo. */
  suggestedCode?: string;
  itemType: TType;
}

/** Cấu hình nhóm hàng của một biến thể danh mục. Giá trị nhóm cũng là tiền tố mã. */
export interface ItemCatalogKit<TType extends string = string> {
  types: readonly TType[];
  defaultType: TType;
}

/**
 * Cổng danh mục mã hàng. Lõi và module nghiệp vụ phụ thuộc cổng này;
 * module biến thể (vd `items-garage`) cung cấp bản cài đặt.
 */
export interface ItemCatalogPort<TItem, TType extends string = string> {
  /** Tra cả lô bằng một query, không ghi DB. Truyền `manager` để đọc trong transaction. */
  match(
    lines: ItemLookupLine[],
    manager?: EntityManager,
  ): Promise<ItemMatch<TItem, TType>[]>;

  /** Trả mã hàng cho từng dòng, tạo các mã chưa có. Phải gọi trong transaction. */
  ensureItems(
    lines: ItemLookupLine[],
    manager: EntityManager,
  ): Promise<{ items: TItem[]; created: TItem[] }>;
}
