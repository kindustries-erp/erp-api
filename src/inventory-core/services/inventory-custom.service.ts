import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ErpInventoryTrackingCustom } from '../entities/erp_inventory_tracking_custom.entity';
import { InventoryCustomQueryDto } from '../dto/inventory-custom-query.dto';

@Injectable()
export class InventoryCustomService {
  constructor(
    @InjectRepository(ErpInventoryTrackingCustom)
    private readonly customRepository: Repository<ErpInventoryTrackingCustom>,
  ) {}

  async listCustoms(query: InventoryCustomQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const qb = this.customRepository
      .createQueryBuilder('custom')
      .leftJoinAndSelect('custom.item', 'item')
      .orderBy('custom.createdAt', 'DESC');

    if (query.itemId) {
      qb.andWhere('custom.itemId = :itemId', { itemId: query.itemId });
    }

    if (query.itemTypeId) {
      qb.andWhere('item.itemTypeId = :itemTypeId', {
        itemTypeId: query.itemTypeId,
      });
    }

    if (query.ids) {
      const idsArray = Array.isArray(query.ids) ? query.ids : [query.ids];
      qb.andWhere('custom.id IN (:...ids)', { ids: idsArray });
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
