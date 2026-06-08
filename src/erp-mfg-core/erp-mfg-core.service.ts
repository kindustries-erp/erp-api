import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { PaginationDto } from '../common/dto/pagination.dto';
import { ErpInventoryItem } from '../inventory-core/entities/erp_inventory_item.entity';
import { ErpInventoryBalance } from '../inventory-core/entities/erp_inventory_balance.entity';
import { ErpPurchaseOrder } from '../purchase-orders-core/entities/erp_purchase_order.entity';
import { ErpVehicle } from './entities/erp_vehicle.entity';

@Injectable()
export class ErpMfgCoreService {
  constructor(
    @InjectRepository(ErpInventoryItem)
    private readonly itemRepository: Repository<ErpInventoryItem>,
    @InjectRepository(ErpInventoryBalance)
    private readonly balanceRepository: Repository<ErpInventoryBalance>,
    @InjectRepository(ErpPurchaseOrder)
    private readonly poRepository: Repository<ErpPurchaseOrder>,
    @InjectRepository(ErpVehicle)
    private readonly vehicleRepository: Repository<ErpVehicle>,
  ) {}

  private directusPaginated<T>(data: T[], total: number, page: number, pageSize: number) {
    return {
      data,
      meta: {
        filter_count: total,
        total_count: total,
        page,
        page_size: pageSize,
        page_count: Math.ceil(total / pageSize),
      },
    };
  }

  async listComponents(query: PaginationDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const [items, total] = await this.itemRepository.findAndCount({
      where: query.search
        ? ([
            { itemType: 'RAW', itemName: ILike(`%${query.search}%`) },
            { itemType: 'RAW', sku: ILike(`%${query.search}%`) },
          ] as any)
        : ({ itemType: 'RAW' } as any),
      skip: (page - 1) * pageSize,
      take: pageSize,
      order: { createdAt: 'DESC' },
    });

    const itemIds = items.map((x) => x.id);
    const balances = itemIds.length
      ? await this.balanceRepository.findBy(itemIds.map((id) => ({ itemId: id })) as any)
      : [];
    const balanceMap = new Map(balances.map((b) => [b.itemId, b]));

    const data = items.map((item) => {
      const bal = balanceMap.get(item.id);
      const onHand = Number(bal?.qtyOnHand ?? 0);
      const reserved = Number(bal?.qtyReserved ?? 0);
      return {
        id: item.id,
        item_code: item.sku,
        item_name: item.itemName,
        item_type: 'COMPONENT',
        tracking_type: 'NONE',
        uom: item.uom,
        is_active: item.status === 'ACTIVE',
        notes: null,
        created_at: item.createdAt?.toISOString?.() ?? null,
        updated_at: item.updatedAt?.toISOString?.() ?? null,
        on_hand_qty: onHand,
        available_qty: onHand - reserved,
      };
    });

    return this.directusPaginated(data, total, page, pageSize);
  }

  async listPurchaseOrders(query: PaginationDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const [rows, total] = await this.poRepository.findAndCount({
      where: query.search
        ? ([{ poNo: ILike(`%${query.search}%`) }] as any)
        : undefined,
      skip: (page - 1) * pageSize,
      take: pageSize,
      order: { createdAt: 'DESC' },
    });

    const data = rows.map((po) => ({
      id: po.id,
      po_no: po.poNo,
      supplier_id: po.supplierId,
      branch_id: null,
      document_date: po.orderDate,
      expected_receipt_date: po.expectedDate,
      status:
        po.status === 'RECEIVED'
          ? 'FULLY_RECEIVED'
          : po.status === 'PARTIAL_RECEIVED'
            ? 'PARTIAL_RECEIVED'
            : po.status,
      notes: po.remarks,
      created_at: po.createdAt?.toISOString?.() ?? null,
    }));

    return this.directusPaginated(data, total, page, pageSize);
  }

  async listVehicles(query: PaginationDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const [rows, total] = await this.vehicleRepository.findAndCount({
      where: query.search
        ? ([
            { vin: ILike(`%${query.search}%`) },
            { frameNo: ILike(`%${query.search}%`) },
            { engineNo: ILike(`%${query.search}%`) },
          ] as any)
        : undefined,
      skip: (page - 1) * pageSize,
      take: pageSize,
      order: { createdAt: 'DESC' },
    });

    const data = rows.map((v) => ({
      id: v.id,
      vin: v.vin,
      frame_no: v.frameNo,
      engine_no: v.engineNo,
      branch_id: v.branchId,
      finished_good_item_id: v.finishedGoodItemId,
      assembly_date: v.assemblyDate,
      status: v.status,
      notes: v.notes,
      created_at: v.createdAt?.toISOString?.() ?? null,
    }));

    return this.directusPaginated(data, total, page, pageSize);
  }
}
