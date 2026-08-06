import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ErpInventoryTrackingLot } from '../entities/erp_inventory_tracking_lot.entity';
import { InventoryLotQueryDto } from '../dto/inventory-lot-query.dto';

@Injectable()
export class InventoryLotService {
  constructor(
    @InjectRepository(ErpInventoryTrackingLot)
    private readonly lotRepository: Repository<ErpInventoryTrackingLot>,
  ) {}

  async listLots(query: InventoryLotQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const qb = this.lotRepository
      .createQueryBuilder('lot')
      .leftJoinAndSelect('lot.item', 'item')
      .orderBy('lot.createdAt', 'DESC');

    if (query.itemId) {
      qb.andWhere('lot.itemId = :itemId', { itemId: query.itemId });
    }

    if (query.itemTypeId) {
      qb.andWhere('item.itemTypeId = :itemTypeId', {
        itemTypeId: query.itemTypeId,
      });
    }

    if (query.ids) {
      const idsArray = Array.isArray(query.ids) ? query.ids : [query.ids];
      qb.andWhere('lot.id IN (:...ids)', { ids: idsArray });
    }

    const [items, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
