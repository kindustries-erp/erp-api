import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ArrayContains, ILike, In, Repository } from 'typeorm';
import { resolveSortOrder } from '../../common/utils/sort.util';
import { ErpInventoryItem } from '../entities/erp_inventory_item.entity';
import { ErpInventoryBalance } from '../entities/erp_inventory_balance.entity';

@Injectable()
export class InventoryItemsQueryService {
  constructor(
    @InjectRepository(ErpInventoryItem)
    private readonly repository: Repository<ErpInventoryItem>,
    @InjectRepository(ErpInventoryBalance)
    private readonly balanceRepository: Repository<ErpInventoryBalance>,
  ) {}

  async findAll(query: any) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const baseWhere: any = { isDeleted: false };
    if (query.status) {
      baseWhere.status = query.status;
    }
    if (query.itemTypeId) {
      baseWhere.itemTypeId = query.itemTypeId;
    }
    if (query.ids) {
      baseWhere.id = In(
        query.ids
          .split(',')
          .map((id: string) => id.trim())
          .filter(Boolean),
      );
    }

    let whereCondition: any = baseWhere;
    if (query.search) {
      whereCondition = [
        { ...baseWhere, itemName: ILike(`%${query.search}%`) },
        { ...baseWhere, sku: ILike(`%${query.search}%`) },
      ];
    }

    if (query.attributes) {
      const attrs = query.attributes.split(',').map((a: string) => a.trim());
      if (Array.isArray(whereCondition)) {
        whereCondition = whereCondition.map((wc) => ({
          ...wc,
          attributes: ArrayContains(attrs),
        }));
      } else {
        whereCondition = {
          ...whereCondition,
          attributes: ArrayContains(attrs),
        };
      }
    }

    const order = resolveSortOrder(query.sort, {
      allowedFields: ['createdAt', 'itemName', 'sku', 'status', 'itemTypeId'],
      columnMap: {
        created_at: 'createdAt',
        item_name: 'itemName',
        item_type_id: 'itemTypeId',
      },
      defaultOrder: { createdAt: 'DESC' },
    });

    const [items, total] = await this.repository.findAndCount({
      where: whereCondition,
      relations: ['uom', 'itemType', 'trackingPolicy', 'trackingCategory'],
      skip: (page - 1) * pageSize,
      take: pageSize,
      order,
    });
    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getBalances(idsString?: string) {
    if (!idsString) return { data: {} };
    const ids = idsString
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    if (!ids.length) return { data: {} };

    const balances = await this.balanceRepository.find({
      where: { itemId: In(ids) } as any,
    });

    const data: Record<string, any> = {};
    for (const b of balances) {
      if (b.itemId) {
        const currentQty = Number(b.qtyOnHand || 0);
        const currentReserved = Number(b.qtyReserved || 0);
        data[b.itemId] = {
          qtyOnHand: currentQty,
          qtyReserved: currentReserved,
          availableQty: currentQty - currentReserved,
        };
      }
    }

    return { data };
  }
}
