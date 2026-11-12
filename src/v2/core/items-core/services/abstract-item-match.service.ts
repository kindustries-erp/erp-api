import type {
  DeepPartial,
  EntityManager,
  EntityTarget,
  Repository,
} from 'typeorm';
import { normalizeVietnamese } from '@/v2/core/base-core';
import type {
  ItemCatalogKit,
  ItemCatalogPort,
  ItemLookupLine,
  ItemMatch,
} from '../contracts/item-catalog.contract';
import type { BaseItemEntity } from '../entities/base-item.entity';
import {
  formatSequenceCode,
  itemTypeOfCode,
  sequencePattern,
} from '../helpers/item-code.helper';
import {
  collectLookupKeys,
  resolveMatches,
} from '../helpers/item-match.helper';

/** Khai báo cụ thể của một biến thể danh mục. */
export interface ItemMatchOptions<
  TItem extends BaseItemEntity,
  TType extends string,
> extends ItemCatalogKit<TType> {
  entity: EntityTarget<TItem>;
  /** Khóa advisory giữ tới khi commit để hai lần tạo song song không sinh trùng mã. */
  lockKey: string;
}

/**
 * Khung đối chiếu dòng hàng với danh mục và tạo mã còn thiếu.
 * Lớp con tiêm repository, gọi `super(repo, options)` và đăng ký provider trong module.
 */
export abstract class AbstractItemMatchService<
  TItem extends BaseItemEntity,
  TType extends string,
> implements ItemCatalogPort<TItem, TType> {
  protected constructor(
    protected readonly repo: Repository<TItem>,
    private readonly options: ItemMatchOptions<TItem, TType>,
  ) {}

  async match(
    lines: ItemLookupLine[],
    manager?: EntityManager,
  ): Promise<ItemMatch<TItem, TType>[]> {
    const { codes, names } = collectLookupKeys(lines, this.options.types);
    if (!codes.length && !names.length) {
      return resolveMatches(lines, [], this.options);
    }
    const repo = manager
      ? manager.getRepository(this.options.entity)
      : this.repo;
    const found = await repo
      .createQueryBuilder('e')
      .where('e.isDeleted = false AND e.isActive = true')
      .andWhere(
        '(e.itemCode = ANY(:codes) OR e.nameNormalized = ANY(:names))',
        { codes, names },
      )
      .orderBy('e.createdAt', 'ASC')
      .getMany();
    return resolveMatches(lines, found, this.options);
  }

  async ensureItems(
    lines: ItemLookupLine[],
    manager: EntityManager,
  ): Promise<{ items: TItem[]; created: TItem[] }> {
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      this.options.lockKey,
    ]);
    const matches = await this.match(lines, manager);
    const created = new Map<string, TItem>();
    const sequences = new Map<TType, number>();
    const items: TItem[] = [];

    for (const [index, match] of matches.entries()) {
      if (match.item) {
        items.push(match.item);
        continue;
      }
      const line = lines[index];
      const nameNormalized = normalizeVietnamese(line.itemName);
      // Hai dòng cùng mã gốc hoặc cùng tên trong một lô chỉ tạo một mã
      const key = match.suggestedCode ?? `name:${nameNormalized}`;
      let item = created.get(key);
      if (!item) {
        const itemCode =
          match.suggestedCode ??
          (await this.nextCode(manager, match.itemType, sequences));
        const row = manager.create(this.options.entity, {
          itemCode,
          itemName: line.itemName.replace(/\s+/g, ' ').trim(),
          nameNormalized,
          unit: line.unit?.trim() || undefined,
          itemType:
            itemTypeOfCode(itemCode, this.options.types) ?? match.itemType,
          source: 'AI',
          isActive: true,
          isDeleted: false,
          extraData: {},
        } as unknown as DeepPartial<TItem>);
        item = await manager.save(this.options.entity, row);
        created.set(key, item);
      }
      items.push(item);
    }
    return { items, created: [...created.values()] };
  }

  /** Số thứ tự kế tiếp của nhóm; đọc max một lần mỗi nhóm rồi tăng trong bộ nhớ. */
  private async nextCode(
    manager: EntityManager,
    type: TType,
    cache: Map<TType, number>,
  ): Promise<string> {
    let current = cache.get(type);
    if (current === undefined) {
      const { tableName } = manager.getRepository(this.options.entity).metadata;
      const rows: { max: number | null }[] = await manager.query(
        `SELECT MAX(substring(item_code from $1)::int) AS max FROM "${tableName}"`,
        [sequencePattern(type)],
      );
      current = Number(rows[0]?.max ?? 0);
    }
    cache.set(type, current + 1);
    return formatSequenceCode(type, current + 1);
  }
}
