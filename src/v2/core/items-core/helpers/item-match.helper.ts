import { normalizeVietnamese } from '@/v2/core/base-core';
import type {
  ItemCatalogKit,
  ItemLookupLine,
  ItemMatch,
  ItemResolveOptions,
} from '../contracts/item-catalog.contract';
import type { BaseItemEntity } from '../entities/base-item.entity';
import {
  codeCandidates,
  itemTypeOfCode,
  normalizeItemCode,
  toItemType,
  withTypePrefix,
} from './item-code.helper';

/** Có được khớp theo tên cho dòng này không (dòng có mã + `whenNoCode` thì không). */
function allowsNameMatch(
  line: ItemLookupLine,
  options: ItemResolveOptions | undefined,
): boolean {
  return (
    options?.nameFallback !== 'whenNoCode' || !normalizeItemCode(line.itemCode)
  );
}

function suggestedCodeOf<TType extends string>(
  line: ItemLookupLine,
  type: TType,
  types: readonly TType[],
  options: ItemResolveOptions | undefined,
): string | undefined {
  const code =
    options?.prefixNewCodes === false
      ? normalizeItemCode(line.itemCode)
      : withTypePrefix(line.itemCode ?? '', type, types);
  return code || undefined;
}

/** Gom mã ứng viên và tên không dấu của cả lô để tra một lần. */
export function collectLookupKeys(
  lines: ItemLookupLine[],
  types: readonly string[],
  options?: ItemResolveOptions,
) {
  const codes = new Set<string>();
  const names = new Set<string>();
  for (const line of lines) {
    codeCandidates(line.itemCode, types).forEach((code) => codes.add(code));
    if (!allowsNameMatch(line, options)) continue;
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
  options?: ItemResolveOptions,
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
    const hit =
      codeHit ??
      (allowsNameMatch(line, options)
        ? byName.get(normalizeVietnamese(line.itemName))
        : undefined);
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
      suggestedCode: suggestedCodeOf(line, type, kit.types, options),
    };
  });
}
