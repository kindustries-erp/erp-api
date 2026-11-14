import { normalizeVietnamese } from '@/v2/core/base-core';
import type {
  ItemLookupLine,
  ResolvableLine,
  ResolvedItemRef,
} from '../contracts/item-catalog.contract';
import { normalizeItemCode } from './item-code.helper';

const isBlank = (value: string | null | undefined) => !value?.trim();

/**
 * Lấy các dòng đủ điều kiện tra danh mục (có mã hoặc có tên) và vị trí gốc của chúng.
 * Dòng trống cả mã lẫn tên bị bỏ qua, giữ nguyên như người dùng nhập.
 */
export function toLookupLines(lines: ResolvableLine[]): {
  lookup: ItemLookupLine[];
  indexes: number[];
} {
  const lookup: ItemLookupLine[] = [];
  const indexes: number[] = [];
  lines.forEach((line, index) => {
    const hasCode = Boolean(normalizeItemCode(line.itemCode));
    const hasName = Boolean(normalizeVietnamese(line.itemName ?? ''));
    if (!hasCode && !hasName) return;
    lookup.push({
      itemCode: line.itemCode,
      itemName: line.itemName ?? '',
      unit: line.unit,
      itemType: line.itemType,
    });
    indexes.push(index);
  });
  return { lookup, indexes };
}

/**
 * Ghi mã chuẩn của danh mục vào dòng. Tên và đơn vị chỉ được điền khi dòng để trống,
 * không ghi đè giá trị người dùng đã nhập. Trả về dòng mới, không sửa dòng gốc.
 */
export function mergeCatalogItems<T extends ResolvableLine>(
  lines: T[],
  indexes: number[],
  items: Array<ResolvedItemRef | undefined>,
): T[] {
  const result = [...lines];
  indexes.forEach((lineIndex, position) => {
    const item = items[position];
    if (!item) return;
    const line = lines[lineIndex];
    result[lineIndex] = {
      ...line,
      itemCode: item.itemCode,
      itemName: isBlank(line.itemName) ? item.itemName : line.itemName,
      unit: isBlank(line.unit) ? (item.unit ?? line.unit) : line.unit,
    };
  });
  return result;
}
