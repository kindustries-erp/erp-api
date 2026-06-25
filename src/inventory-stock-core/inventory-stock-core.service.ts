import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In, Brackets } from 'typeorm';
import { PaginationDto } from '../common/dto/pagination.dto';
import { ErpInventoryBalance } from '../inventory-core/entities/erp_inventory_balance.entity';
import { ErpInventoryItem } from '../inventory-core/entities/erp_inventory_item.entity';
import { ErpInventoryTransaction } from '../inventory-core/entities/erp_inventory_transaction.entity';

@Injectable()
export class InventoryStockCoreService {
  constructor(
    @InjectRepository(ErpInventoryBalance)
    private readonly balanceRepository: Repository<ErpInventoryBalance>,
    @InjectRepository(ErpInventoryItem)
    private readonly itemRepository: Repository<ErpInventoryItem>,
    @InjectRepository(ErpInventoryTransaction)
    private readonly transactionRepository: Repository<ErpInventoryTransaction>,
  ) {}

  async findAll(
    query: PaginationDto & { item_type?: string; search?: string },
  ) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const qb = this.itemRepository.createQueryBuilder('item');
    qb.leftJoin(ErpInventoryBalance, 'b', 'b.itemId = item.id');

    if (query.item_type && query.search) {
      qb.where(
        new Brackets((qbInner) => {
          qbInner
            .where('item.itemType = :type AND item.sku LIKE :search', {
              type: query.item_type,
              search: `%${query.search}%`,
            })
            .orWhere('item.itemType = :type AND item.itemName LIKE :search', {
              type: query.item_type,
              search: `%${query.search}%`,
            });
        }),
      );
    } else if (query.item_type) {
      qb.where('item.itemType = :type', { type: query.item_type });
    } else if (query.search) {
      qb.where(
        new Brackets((qbInner) => {
          qbInner
            .where('item.sku LIKE :search', { search: `%${query.search}%` })
            .orWhere('item.itemName LIKE :search', {
              search: `%${query.search}%`,
            });
        }),
      );
    }

    if (query.sort) {
      const isDesc = query.sort.startsWith('-');
      const field = isDesc ? query.sort.substring(1) : query.sort;
      const order = isDesc ? 'DESC' : 'ASC';

      let sortField = '';
      if (field === 'item_code') sortField = 'item.sku';
      else if (field === 'item_type') sortField = 'item.itemType';
      else if (field === 'status') sortField = 'item.status';
      else if (field === 'unit') sortField = 'item.uom';
      else if (field === 'item') sortField = 'item.itemName';

      if (sortField) {
        qb.orderBy(sortField, order);
      } else {
        qb.addSelect('b.updatedAt').orderBy(
          'b.updatedAt',
          'DESC',
          'NULLS LAST',
        );
      }
    } else {
      qb.addSelect('b.updatedAt').orderBy('b.updatedAt', 'DESC', 'NULLS LAST');
    }

    qb.offset((page - 1) * pageSize).limit(pageSize);

    const items = await qb.getMany();

    const countQb = qb.clone();
    countQb.orderBy(); // clear order by for count query to avoid distinctAlias error
    const total = await countQb.getCount();

    if (items.length === 0) {
      return { items: [], total: 0, page, pageSize, totalPages: 0 };
    }

    const itemIds = items.map((i) => i.id);

    const balances = await this.balanceRepository.find({
      where: { itemId: In(itemIds) },
    });
    const balanceMap = new Map(balances.map((b) => [b.itemId, b]));

    const transactionSums = await this.transactionRepository
      .createQueryBuilder('txn')
      .select('txn.itemId', 'itemId')
      .addSelect('COALESCE(SUM(txn.qtyIn), 0)', 'receivedQty')
      .addSelect('COALESCE(SUM(txn.qtyOut), 0)', 'issuedQty')
      .where('txn.itemId IN (:...itemIds)', { itemIds })
      .groupBy('txn.itemId')
      .getRawMany<{
        itemId: string;
        receivedQty: string;
        issuedQty: string;
      }>();
    const txnMap = new Map(transactionSums.map((row) => [row.itemId, row]));

    const rows = items.map((item) => {
      const b = balanceMap.get(item.id);
      const txn = txnMap.get(item.id);
      return {
        inventory_item_id: item.id,
        branch_id: null,
        item_code: item.sku ?? '',
        item_name: item.itemName ?? '',
        item_type: item.itemType ?? '',
        unit: item.uom ?? '',
        received_qty: Number(txn?.receivedQty || 0),
        issued_qty: Number(txn?.issuedQty || 0),
        on_hand_qty: Number(b?.qtyOnHand || 0),
        stock_value: Number(b?.inventoryValue || 0),
        last_transaction_date: b?.updatedAt?.toISOString?.() ?? null,
        status: item.status,
      };
    });

    return {
      items: rows,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
