import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { normalizeVietnamese } from '@/v2/core/base-core';
import { GarageItem } from '../entities/garage-item.entity';
import {
  formatSequenceCode,
  GarageItemType,
  itemTypeOfCode,
  sequencePattern,
} from '../helpers/garage-item-code.helper';
import {
  collectLookupKeys,
  GarageItemLookupLine,
  GarageItemMatch,
  resolveMatches,
} from '../helpers/garage-item-match.helper';

const LOCK_KEY = 'items_garage:ensure';

/** Đối chiếu dòng hàng với danh mục garage và tạo mã còn thiếu. */
@Injectable()
export class GarageItemMatchService {
  constructor(
    @InjectRepository(GarageItem)
    private readonly repo: Repository<GarageItem>,
  ) {}

  /** Tra cả lô bằng một query, không ghi DB. Truyền `manager` để đọc trong transaction. */
  async match(
    lines: GarageItemLookupLine[],
    manager?: EntityManager,
  ): Promise<GarageItemMatch[]> {
    const { codes, names } = collectLookupKeys(lines);
    if (!codes.length && !names.length) return resolveMatches(lines, []);
    const repo = manager ? manager.getRepository(GarageItem) : this.repo;
    const found = await repo
      .createQueryBuilder('e')
      .where('e.isDeleted = false AND e.isActive = true')
      .andWhere(
        '(e.itemCode = ANY(:codes) OR e.nameNormalized = ANY(:names))',
        { codes, names },
      )
      .orderBy('e.createdAt', 'ASC')
      .getMany();
    return resolveMatches(lines, found);
  }

  /**
   * Trả về mã hàng cho từng dòng, tạo mới các mã chưa có. Phải gọi trong transaction:
   * khóa advisory giữ tới khi commit để hai lần tạo song song không sinh trùng mã.
   */
  async ensureItems(
    lines: GarageItemLookupLine[],
    manager: EntityManager,
  ): Promise<{ items: GarageItem[]; created: GarageItem[] }> {
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      LOCK_KEY,
    ]);
    const matches = await this.match(lines, manager);
    const created = new Map<string, GarageItem>();
    const sequences = new Map<GarageItemType, number>();
    const items: GarageItem[] = [];

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
        item = await manager.save(
          GarageItem,
          manager.create(GarageItem, {
            itemCode,
            itemName: line.itemName.replace(/\s+/g, ' ').trim(),
            nameNormalized,
            unit: line.unit?.trim() || undefined,
            itemType: itemTypeOfCode(itemCode) ?? match.itemType,
            source: 'AI',
            isActive: true,
            isDeleted: false,
            extraData: {},
          }),
        );
        created.set(key, item);
      }
      items.push(item);
    }
    return { items, created: [...created.values()] };
  }

  /** Số thứ tự kế tiếp của nhóm; đọc max một lần mỗi nhóm rồi tăng trong bộ nhớ. */
  private async nextCode(
    manager: EntityManager,
    type: GarageItemType,
    cache: Map<GarageItemType, number>,
  ): Promise<string> {
    let current = cache.get(type);
    if (current === undefined) {
      const rows: { max: number | null }[] = await manager.query(
        `SELECT MAX(substring(item_code from $1)::int) AS max FROM items_garage`,
        [sequencePattern(type)],
      );
      current = Number(rows[0]?.max ?? 0);
    }
    cache.set(type, current + 1);
    return formatSequenceCode(type, current + 1);
  }
}
