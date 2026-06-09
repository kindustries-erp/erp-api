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

    // Build item filter to restrict balance lookup
    let filteredItemIds: string[] | null = null;
    if (query.item_type || query.search) {
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
      const matchedItems = await this.itemRepository.find({
        where: whereConditions,
      });
      filteredItemIds = matchedItems.map((i) => i.id);
    }

    // If filtered and no items match, return empty
    if (filteredItemIds !== null && filteredItemIds.length === 0) {
      return { items: [], total: 0, page, pageSize, totalPages: 0 };
    }

    const whereBalance: any =
      filteredItemIds !== null ? { itemId: filteredItemIds as any } : {};

    const [balances, total] = await this.balanceRepository.findAndCount({
      where: whereBalance,
      skip: (page - 1) * pageSize,
      take: pageSize,
      order: { updatedAt: 'DESC' },
    });

    const itemIds = [
      ...new Set(balances.map((b) => b.itemId).filter(Boolean)),
    ] as string[];
    const items = itemIds.length
      ? await this.itemRepository.findByIds(itemIds as any)
      : [];
    const itemMap = new Map(items.map((i) => [i.id, i]));

    const transactionSums = itemIds.length
      ? await this.transactionRepository
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
          }>()
      : [];
    const txnMap = new Map(transactionSums.map((row) => [row.itemId, row]));

    const rows = balances.map((b) => {
      const item = b.itemId ? itemMap.get(b.itemId) : null;
      const txn = b.itemId ? txnMap.get(b.itemId) : null;
      return {
        inventory_item_id: b.itemId,
        branch_id: null,
        item_code: item?.sku ?? '',
        item_name: item?.itemName ?? '',
        item_type: item?.itemType ?? '',
        unit: item?.uom ?? '',
        received_qty: Number(txn?.receivedQty || 0),
        issued_qty: Number(txn?.issuedQty || 0),
        on_hand_qty: Number(b.qtyOnHand || 0),
        stock_value: Number(b.inventoryValue || 0),
        last_transaction_date: b.updatedAt?.toISOString?.() ?? null,
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
