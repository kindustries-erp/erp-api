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

/** Cách đối chiếu và tạo mã. Mặc định giữ hành vi của luồng hóa đơn AI. */
export interface ItemResolveOptions {
  /**
   * `always`: dòng có mã mà không khớp mã vẫn được khớp theo tên (hóa đơn nhà cung cấp dùng mã khác mã nội bộ).
   * `whenNoCode`: dòng có mã chỉ khớp theo mã; chỉ dòng không mã mới khớp theo tên (chứng từ nhập tay).
   */
  nameFallback?: 'always' | 'whenNoCode';
  /** Mã mới từ mã gốc trên chứng từ: `true` gắn tiền tố nhóm (mặc định), `false` giữ nguyên mã đã chuẩn hóa. */
  prefixNewCodes?: boolean;
  /** Nguồn ghi cho mã mới tạo trong `ensureItems`. Mặc định `MANUAL`. */
  source?: ItemSource;
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
    options?: ItemResolveOptions,
  ): Promise<ItemMatch<TItem, TType>[]>;

  /** Trả mã hàng cho từng dòng, tạo các mã chưa có. Phải gọi trong transaction. */
  ensureItems(
    lines: ItemLookupLine[],
    manager: EntityManager,
    options?: ItemResolveOptions,
  ): Promise<{ items: TItem[]; created: TItem[] }>;
}

/** Dòng chứng từ có thể được chuẩn hóa mã hàng theo danh mục. */
export interface ResolvableLine {
  itemCode?: string | null;
  itemName?: string | null;
  unit?: string | null;
  itemType?: string | null;
}

/** Phần của một mã trong danh mục mà dòng chứng từ cần. */
export interface ResolvedItemRef {
  itemCode: string;
  itemName: string;
  unit?: string | null;
}

/**
 * Cổng chuẩn hóa mã hàng cho dòng chứng từ (PR, PO, nhận hàng, phiếu kho).
 * `create = true`: mã chưa có thì tạo. `create = false`: chỉ chuẩn hóa mã đã có, không tạo.
 */
export interface LineItemResolverPort {
  resolveLines<T extends ResolvableLine>(
    manager: EntityManager,
    lines: T[],
    options?: { create?: boolean },
  ): Promise<T[]>;
}
