import { normalizeVietnamese } from '@/v2/core/base-core';
import type {
  ItemCatalogKit,
  ItemLookupLine,
  ItemMatch,
} from '../contracts/item-catalog.contract';
import type { BaseItemEntity } from '../entities/base-item.entity';
import {
  codeCandidates,
  itemTypeOfCode,
  toItemType,
  withTypePrefix,
} from './item-code.helper';

/** Gom mã ứng viên và tên không dấu của cả lô để tra một lần. */
export function collectLookupKeys(
  lines: ItemLookupLine[],
  types: readonly string[],
) {
  const codes = new Set<string>();
  const names = new Set<string>();
  for (const line of lines) {
    codeCandidates(line.itemCode, types).forEach((code) => codes.add(code));
    const name = normalizeVietnamese(line.itemName);
    if (name) names.add(name);
  }
  return { codes: [...codes], names: [...names] };
}

/** Khớp từng dòng với các mã đã tìm thấy: theo mã trước, rồi tới tên không dấu. Hàm thuần. */
export function resolveMatches<
  TItem extends BaseItemEntity,
  TType extends string,
>(
  lines: ItemLookupLine[],
  found: TItem[],
  kit: ItemCatalogKit<TType>,
): ItemMatch<TItem, TType>[] {
  const byCode = new Map(found.map((item) => [item.itemCode, item]));
  const byName = new Map<string, TItem>();
  for (const item of found) {
    if (!byName.has(item.nameNormalized)) byName.set(item.nameNormalized, item);
  }

  return lines.map((line) => {
    const type =
      itemTypeOfCode(line.itemCode ?? '', kit.types) ??
      toItemType(line.itemType, kit.types, kit.defaultType);
    const codeHit = codeCandidates(line.itemCode, kit.types)
      .map((code) => byCode.get(code))
      .find(Boolean);
    const hit = codeHit ?? byName.get(normalizeVietnamese(line.itemName));
    if (hit) {
      return {
        status: 'MATCHED',
        matchedBy: codeHit ? 'CODE' : 'NAME',
        item: hit,
        itemType: itemTypeOfCode(hit.itemCode, kit.types) ?? type,
      };
    }
    return {
      status: 'NEW',
      itemType: type,
      suggestedCode:
        withTypePrefix(line.itemCode ?? '', type, kit.types) || undefined,
    };
  });
}
