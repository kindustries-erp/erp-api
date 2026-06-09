import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { PaginationDto } from '../common/dto/pagination.dto';
import { ErpInventoryItem } from '../inventory-core/entities/erp_inventory_item.entity';
import { ErpInventoryBalance } from '../inventory-core/entities/erp_inventory_balance.entity';
import { ErpInventoryTransaction } from '../inventory-core/entities/erp_inventory_transaction.entity';
import { ErpInventoryLot } from '../inventory-core/entities/erp_inventory_lot.entity';
import { ErpInventorySerial } from '../inventory-core/entities/erp_inventory_serial.entity';
import { ErpPurchaseOrder } from '../purchase-orders-core/entities/erp_purchase_order.entity';
import { ErpPurchaseOrderLine } from '../purchase-orders-core/entities/erp_purchase_order_line.entity';
import { ErpVehicle } from './entities/erp_vehicle.entity';

@Injectable()
export class ErpMfgCoreService {
  constructor(
    @InjectRepository(ErpInventoryItem)
    private readonly itemRepository: Repository<ErpInventoryItem>,
    @InjectRepository(ErpInventoryBalance)
    private readonly balanceRepository: Repository<ErpInventoryBalance>,
    @InjectRepository(ErpInventoryTransaction)
    private readonly txnRepository: Repository<ErpInventoryTransaction>,
    @InjectRepository(ErpInventoryLot)
    private readonly lotRepository: Repository<ErpInventoryLot>,
    @InjectRepository(ErpInventorySerial)
    private readonly serialRepository: Repository<ErpInventorySerial>,
    @InjectRepository(ErpPurchaseOrder)
    private readonly poRepository: Repository<ErpPurchaseOrder>,
    @InjectRepository(ErpPurchaseOrderLine)
    private readonly poLineRepository: Repository<ErpPurchaseOrderLine>,
    @InjectRepository(ErpVehicle)
    private readonly vehicleRepository: Repository<ErpVehicle>,
  ) {}

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  private directusPaginated<T>(
    data: T[],
    total: number,
    page: number,
    pageSize: number,
  ) {
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

  // ─── Components (inventory items of type RAW) ─────────────────────────────────

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
      ? await this.balanceRepository.findBy(
          itemIds.map((id) => ({ itemId: id })) as any,
        )
      : [];
    const balanceMap = new Map(balances.map((b) => [b.itemId, b]));

    const data = items.map((item) =>
      this.mapComponent(item, balanceMap.get(item.id)),
    );
    return this.directusPaginated(data, total, page, pageSize);
  }

  async getComponent(id: string) {
    const item = await this.itemRepository.findOne({ where: { id } as any });
    if (!item) throw new NotFoundException(`Component ${id} not found`);
    const bal = await this.balanceRepository.findOne({
      where: { itemId: id } as any,
    });
    return this.mapComponent(item, bal ?? undefined);
  }

  async updateComponent(
    id: string,
    dto: {
      item_name?: string;
      tracking_type?: string;
      uom?: string;
      is_active?: boolean;
      notes?: string;
    },
  ) {
    const item = await this.itemRepository.findOne({ where: { id } as any });
    if (!item) throw new NotFoundException(`Component ${id} not found`);
    if (dto.item_name !== undefined) item.itemName = dto.item_name;
    if (dto.uom !== undefined) item.uom = dto.uom;
    if (dto.is_active !== undefined)
      item.status = dto.is_active ? 'ACTIVE' : 'INACTIVE';
    await this.itemRepository.save(item);
    const bal = await this.balanceRepository.findOne({
      where: { itemId: id } as any,
    });
    return this.mapComponent(item, bal ?? undefined);
  }

  async createComponent(dto: {
    item_code: string;
    item_name: string;
    tracking_type?: string;
    uom?: string;
    is_active?: boolean;
    notes?: string;
  }) {
    const item = this.itemRepository.create({
      sku: dto.item_code,
      itemName: dto.item_name,
      itemType: 'RAW',
      uom: dto.uom ?? 'PCS',
      status: dto.is_active === false ? 'INACTIVE' : 'ACTIVE',
    });
    const saved = await this.itemRepository.save(item);
    return this.mapComponent(saved, undefined);
  }

  async getComponentStockSummary(id: string) {
    const item = await this.itemRepository.findOne({ where: { id } as any });
    if (!item) throw new NotFoundException(`Component ${id} not found`);

    const bal = await this.balanceRepository.findOne({
      where: { itemId: id } as any,
    });
    const onHand = Number(bal?.qtyOnHand ?? 0);
    const reserved = Number(bal?.qtyReserved ?? 0);

    const txnCount = await this.txnRepository.count({
      where: { itemId: id } as any,
    });

    // lots
    const lots = await this.lotRepository.findBy({ itemId: id } as any);
    const lotsData = lots.map((l) => ({
      id: l.id,
      lot_code: l.lotCode,
      received_qty: Number(l.receivedQty),
      issued_qty: Number(l.issuedQty),
      on_hand_qty: Number(l.receivedQty) - Number(l.issuedQty),
      expiry_date: l.expiryDate ?? null,
    }));

    // serials
    const serials = await this.serialRepository.findBy({ itemId: id } as any);
    const serialsData = serials.map((s) => ({
      id: s.id,
      serial_no: s.serialNo,
      status: s.status,
      vin_id: s.vinId ?? null,
      receipt_line_id: s.receiptLineId ?? null,
    }));

    return {
      item: this.mapComponent(item, bal ?? undefined),
      stock: {
        on_hand_qty: onHand,
        available_qty: onHand - reserved,
        txn_count: txnCount,
        lot_count: lotsData.length,
        serial_count: serialsData.length,
      },
      lots: lotsData,
      serials: serialsData,
    };
  }

  async listComponentTxns(id: string, query: PaginationDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const [txns, total] = await this.txnRepository.findAndCount({
      where: { itemId: id } as any,
      skip: (page - 1) * pageSize,
      take: pageSize,
      order: { createdAt: 'DESC' },
    });

    const data = txns.map((t) => ({
      id: t.id,
      txn_type: t.transactionType,
      txn_date: t.transactionDate,
      qty: Number(t.qtyIn ?? 0) - Number(t.qtyOut ?? 0),
      unit_cost: Number(t.unitCost ?? 0),
      amount: null,
      tracking_type: 'NONE',
      lot_code: null,
      source_type: t.documentType ?? null,
      source_id: t.documentId ?? null,
      source_no: null,
      notes: t.notes ?? null,
      receipt: null,
      purchase_order: null,
      issue: null,
      vin: null,
    }));

    return this.directusPaginated(data, total, page, pageSize);
  }

  // ─── Purchase Orders ──────────────────────────────────────────────────────────

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

    const data = rows.map((po) => this.mapPo(po));
    return this.directusPaginated(data, total, page, pageSize);
  }

  async getPurchaseOrder(id: string) {
    const po = await this.poRepository.findOne({ where: { id } as any });
    if (!po) throw new NotFoundException(`Purchase order ${id} not found`);

    const lines = await this.poLineRepository.find({
      where: { purchaseOrderId: id } as any,
      order: { lineNo: 'ASC' },
    });

    return {
      ...this.mapPo(po),
      lines: lines.map((l) => ({
        id: l.id,
        inventory_item_id: l.itemId,
        ordered_qty: Number(l.qtyOrdered),
        received_qty: Number(l.qtyReceived),
        unit_price: l.unitPrice !== null ? Number(l.unitPrice) : null,
        notes: null,
      })),
    };
  }

  // ─── Vehicles ─────────────────────────────────────────────────────────────────

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

    const data = rows.map((v) => this.mapVehicle(v));
    return this.directusPaginated(data, total, page, pageSize);
  }

  async getVehicle(id: string) {
    const v = await this.vehicleRepository.findOne({ where: { id } as any });
    if (!v) throw new NotFoundException(`Vehicle ${id} not found`);
    return this.mapVehicle(v);
  }

  async createVehicle(dto: {
    vin?: string | null;
    frame_no: string;
    engine_no: string;
    finished_good_item_id?: string | null;
    assembly_date?: string | null;
    branch_id?: string | null;
    notes?: string | null;
    serial_no?: string | null;
  }) {
    const canonicalVin = dto.frame_no.trim();
    const vehicle = this.vehicleRepository.create({
      vin: dto.vin?.trim() || canonicalVin,
      frameNo: canonicalVin,
      engineNo: dto.engine_no,
      finishedGoodItemId: dto.finished_good_item_id ?? null,
      assemblyDate: dto.assembly_date ?? null,
      branchId: dto.branch_id ?? null,
      notes: dto.notes ?? null,
      status: 'ASSEMBLED',
    });
    const savedVehicle = await this.vehicleRepository.save(vehicle);

    if (dto.serial_no?.trim()) {
      const serial = await this.serialRepository.findOne({
        where: { serialNo: dto.serial_no.trim() } as any,
      });
      if (serial) {
        serial.vinId = savedVehicle.id;
        await this.serialRepository.save(serial);
      }
    }

    return this.mapVehicle(savedVehicle);
  }

  // ─── Internal mappers ─────────────────────────────────────────────────────────

  private mapComponent(item: ErpInventoryItem, bal?: ErpInventoryBalance) {
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
  }

  private mapPo(po: ErpPurchaseOrder) {
    return {
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
    };
  }

  private mapVehicle(v: ErpVehicle) {
    return {
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
    };
  }
}
