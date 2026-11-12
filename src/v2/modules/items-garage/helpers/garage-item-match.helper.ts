import { normalizeVietnamese } from '@/v2/core/base-core';
import { GarageItem } from '../entities/garage-item.entity';
import {
  codeCandidates,
  GarageItemType,
  itemTypeOfCode,
  toGarageItemType,
  withTypePrefix,
} from './garage-item-code.helper';

/** Một dòng hàng cần đối chiếu với danh mục. */
export interface GarageItemLookupLine {
  itemCode?: string | null;
  itemName: string;
  unit?: string | null;
  itemType?: string | null;
}

export interface GarageItemMatch {
  status: 'MATCHED' | 'NEW';
  matchedBy?: 'CODE' | 'NAME';
  item?: GarageItem;
  /** Mã đề xuất cho dòng NEW khi chứng từ có mã gốc; không có thì sinh số lúc tạo. */
  suggestedCode?: string;
  itemType: GarageItemType;
}

/** Gom mã ứng viên và tên không dấu của cả lô để tra một lần. */
export function collectLookupKeys(lines: GarageItemLookupLine[]) {
  const codes = new Set<string>();
  const names = new Set<string>();
  for (const line of lines) {
    codeCandidates(line.itemCode).forEach((code) => codes.add(code));
    const name = normalizeVietnamese(line.itemName);
    if (name) names.add(name);
  }
  return { codes: [...codes], names: [...names] };
}

/** Khớp từng dòng với các mã đã tìm thấy: theo mã trước, rồi tới tên không dấu. Hàm thuần. */
export function resolveMatches(
  lines: GarageItemLookupLine[],
  found: GarageItem[],
): GarageItemMatch[] {
  const byCode = new Map(found.map((item) => [item.itemCode, item]));
  const byName = new Map<string, GarageItem>();
  for (const item of found) {
    if (!byName.has(item.nameNormalized)) byName.set(item.nameNormalized, item);
  }

  return lines.map((line) => {
    const type =
      itemTypeOfCode(line.itemCode ?? '') ?? toGarageItemType(line.itemType);
    const codeHit = codeCandidates(line.itemCode)
      .map((code) => byCode.get(code))
      .find(Boolean);
    const hit = codeHit ?? byName.get(normalizeVietnamese(line.itemName));
    if (hit) {
      return {
        status: 'MATCHED',
        matchedBy: codeHit ? 'CODE' : 'NAME',
        item: hit,
        itemType: itemTypeOfCode(hit.itemCode) ?? type,
      };
    }
    return {
      status: 'NEW',
      itemType: type,
      suggestedCode: withTypePrefix(line.itemCode ?? '', type) || undefined,
    };
  });
}
