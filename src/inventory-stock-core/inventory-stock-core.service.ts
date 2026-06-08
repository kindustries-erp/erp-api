import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationDto } from '../common/dto/pagination.dto';
import { ErpInventoryBalance } from '../inventory-core/entities/erp_inventory_balance.entity';
import { ErpInventoryItem } from '../inventory-core/entities/erp_inventory_item.entity';

@Injectable()
export class InventoryStockCoreService {
  constructor(
    @InjectRepository(ErpInventoryBalance)
    private readonly balanceRepository: Repository<ErpInventoryBalance>,
    @InjectRepository(ErpInventoryItem)
    private readonly itemRepository: Repository<ErpInventoryItem>,
  ) {}

  async findAll(query: PaginationDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const [balances, total] = await this.balanceRepository.findAndCount({
      skip: (page - 1) * pageSize,
      take: pageSize,
      order: { updatedAt: 'DESC' },
    });

    const itemIds = [...new Set(balances.map((b) => b.itemId).filter(Boolean))] as string[];
    const items = itemIds.length
      ? await this.itemRepository.findByIds(itemIds as any)
      : [];
    const itemMap = new Map(items.map((i) => [i.id, i]));

    const rows = balances.map((b) => {
      const item = b.itemId ? itemMap.get(b.itemId) : null;
      return {
        inventory_item_id: b.itemId,
        branch_id: null,
        item_code: item?.sku ?? '',
        item_name: item?.itemName ?? '',
        unit: item?.uom ?? '',
        received_qty: Number(b.qtyOnHand || 0) + Number(b.qtyReserved || 0),
        issued_qty: Number(b.qtyReserved || 0),
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
