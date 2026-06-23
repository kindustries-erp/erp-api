import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In } from 'typeorm';
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

    // Query itemRepository directly to include items with no stock
    const whereConditions: any[] = [];
    if (query.item_type && query.search) {
      whereConditions.push(
        { itemType: query.item_type, sku: Like(`%${query.search}%`) },
        { itemType: query.item_type, itemName: Like(`%${query.search}%`) },
      );
    } else if (query.item_type) {
      whereConditions.push({ itemType: query.item_type });
    } else if (query.search) {
      whereConditions.push(
        { sku: Like(`%${query.search}%`) },
        { itemName: Like(`%${query.search}%`) },
      );
    }

    const findOptions: any = {
      skip: (page - 1) * pageSize,
      take: pageSize,
      order: { createdAt: 'DESC' },
    };

    if (query.sort) {
      const isDesc = query.sort.startsWith('-');
      const field = isDesc ? query.sort.substring(1) : query.sort;
      const order = isDesc ? 'DESC' : 'ASC';

      let sortField = '';
      if (field === 'item_code') sortField = 'sku';
      else if (field === 'item_type') sortField = 'itemType';
      else if (field === 'status') sortField = 'status';
      else if (field === 'unit') sortField = 'uom';
      else if (field === 'item') sortField = 'itemName';

      if (sortField) {
        findOptions.order = { [sortField]: order };
      }
    }
    if (whereConditions.length > 0) {
      findOptions.where = whereConditions;
    }

    const [items, total] = await this.itemRepository.findAndCount(findOptions);

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
