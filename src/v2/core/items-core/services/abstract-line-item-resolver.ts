import type { EntityManager } from 'typeorm';
import type {
  ItemCatalogPort,
  ItemResolveOptions,
  LineItemResolverPort,
  ResolvableLine,
  ResolvedItemRef,
} from '../contracts/item-catalog.contract';
import { mergeCatalogItems, toLookupLines } from '../helpers/line-items.helper';

/** Cách chuẩn hóa dòng chứng từ nhập tay: dòng có mã chỉ khớp theo mã, mã mới giữ nguyên mã gõ vào. */
export const MANUAL_LINE_RESOLVE_OPTIONS: ItemResolveOptions = {
  nameFallback: 'whenNoCode',
  prefixNewCodes: false,
  source: 'MANUAL',
};

/**
 * Chuẩn hóa mã hàng cho dòng chứng từ (PR, PO, nhận hàng, phiếu kho) bằng cổng danh mục.
 * Lớp con của module biến thể chỉ truyền cổng của mình vào `super(catalog)`.
 */
export abstract class AbstractLineItemResolver<
  TItem extends ResolvedItemRef,
  TType extends string,
> implements LineItemResolverPort {
  protected constructor(
    private readonly catalog: ItemCatalogPort<TItem, TType>,
  ) {}

  async resolveLines<T extends ResolvableLine>(
    manager: EntityManager,
    lines: T[],
    options: { create?: boolean } = {},
  ): Promise<T[]> {
    const { lookup, indexes } = toLookupLines(lines);
    if (lookup.length === 0) return lines;

    const items: Array<TItem | undefined> =
      options.create === false
        ? (
            await this.catalog.match(
              lookup,
              manager,
              MANUAL_LINE_RESOLVE_OPTIONS,
            )
          ).map((m) => m.item)
        : (
            await this.catalog.ensureItems(
              lookup,
              manager,
              MANUAL_LINE_RESOLVE_OPTIONS,
            )
          ).items;
    return mergeCatalogItems(lines, indexes, items);
  }

  /**
   * Như `resolveLines` nhưng quyết định tạo mã theo từng dòng (vd phiếu điều chỉnh: dòng tăng tạo mã,
   * dòng giảm chỉ chuẩn hóa). Giữ nguyên thứ tự dòng.
   */
  async resolveLinesBy<T extends ResolvableLine>(
    manager: EntityManager,
    lines: T[],
    createOf: (line: T) => boolean,
  ): Promise<T[]> {
    const result = [...lines];
    for (const create of [true, false]) {
      const indexes = lines.flatMap((line, i) =>
        createOf(line) === create ? [i] : [],
      );
      if (indexes.length === 0) continue;
      const resolved = await this.resolveLines(
        manager,
        indexes.map((i) => lines[i]),
        { create },
      );
      indexes.forEach((lineIndex, k) => {
        result[lineIndex] = resolved[k];
      });
    }
    return result;
  }
}
