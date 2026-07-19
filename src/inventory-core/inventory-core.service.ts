import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, ILike, Repository, In, ArrayContains } from 'typeorm';
import { PaginationDto } from '../common/dto/pagination.dto';
import { resolveSortOrder } from '../common/utils/sort.util';
import { ErpInventoryItem } from './entities/erp_inventory_item.entity';
import { ErpInventoryTransaction } from './entities/erp_inventory_transaction.entity';
import { ErpInventoryBalance } from './entities/erp_inventory_balance.entity';
import { CreateInventoryItemDto } from './dto/create-item.dto';
import { UpdateInventoryItemDto } from './dto/update-item.dto';
import { ErpUom } from './entities/erp_uom.entity';
import { ErpItemType } from './entities/erp_item_type.entity';
import { ErpTrackingPolicy } from './entities/erp_tracking_policy.entity';
import { ErpTrackingCategory } from './entities/erp_tracking_category.entity';
import { ErpInventoryTrackingSerial } from './entities/erp_inventory_tracking_serial.entity';
import { CreateUomDto } from './dto/create-uom.dto';
import { UpdateUomDto } from './dto/update-uom.dto';
import { CreateItemTypeDto } from './dto/create-item-type.dto';
import { UpdateItemTypeDto } from './dto/update-item-type.dto';
import { CreateTrackingCategoryDto } from './dto/create-tracking-category.dto';
import { UpdateTrackingCategoryDto } from './dto/update-tracking-category.dto';
import { InventoryMasterQueryDto } from './dto/inventory-master-query.dto';
import { WarehouseVoucherQueryDto } from './dto/warehouse-voucher-query.dto';
import { InventorySerialQueryDto } from './dto/inventory-serial-query.dto';
import { GraphLayoutService } from '../common/services/graph-layout.service';
import { UpdateInventorySerialDto } from './dto/update-inventory-serial.dto';
import { ErpSerialLifecycle } from './entities/erp_serial_lifecycle.entity';
import { ConfirmDeliveryDto } from './dto/confirm-delivery.dto';
import { UpdateSerialLifecycleDto } from './dto/update-serial-lifecycle.dto';
import { ErpSalesOrder } from '../sales-orders-core/entities/erp_sales_order.entity';
import { ErpSalesOrderLine } from '../sales-orders-core/entities/erp_sales_order_line.entity';
import { ErpVehicle } from '../erp-mfg-core/entities/erp_vehicle.entity';
import { InventoryDashboardQueryDto } from './dto/inventory-dashboard-query.dto';

@Injectable()
export class InventoryItemsService {
  constructor(
    @InjectRepository(ErpInventoryItem)
    private readonly repository: Repository<ErpInventoryItem>,
    @InjectRepository(ErpInventoryTransaction)
    private readonly txnRepository: Repository<ErpInventoryTransaction>,
    @InjectRepository(ErpInventoryBalance)
    private readonly balanceRepository: Repository<ErpInventoryBalance>,
    @InjectRepository(ErpUom)
    private readonly uomRepository: Repository<ErpUom>,
    @InjectRepository(ErpItemType)
    private readonly itemTypeRepository: Repository<ErpItemType>,
    @InjectRepository(ErpTrackingCategory)
    private readonly trackingCategoryRepository: Repository<ErpTrackingCategory>,
    @InjectRepository(ErpTrackingPolicy)
    private readonly trackingPolicyRepository: Repository<ErpTrackingPolicy>,
    @InjectRepository(ErpInventoryTrackingSerial)
    private readonly serialRepository: Repository<ErpInventoryTrackingSerial>,
    private readonly dataSource: DataSource,
    private readonly graphLayoutService: GraphLayoutService,
  ) {}

  private normalizeCode(value: string) {
    return value.trim().toUpperCase();
  }

  private buildMasterWhere(query: InventoryMasterQueryDto) {
    const baseWhere =
      query.isActive !== undefined
        ? { isActive: query.isActive, isDeleted: false }
        : { isDeleted: false };

    if (query.search) {
      return [
        { ...baseWhere, code: ILike(`%${query.search}%`) },
        { ...baseWhere, name: ILike(`%${query.search}%`) },
        { ...baseWhere, description: ILike(`%${query.search}%`) },
      ];
    }

    return Object.keys(baseWhere).length > 0 ? baseWhere : undefined;
  }

  private async ensureUomActive(code: string) {
    const normalized = this.normalizeCode(code);
    const uom = await this.uomRepository.findOne({
      where: { code: normalized, isDeleted: false },
    });
    if (!uom) {
      throw new BadRequestException(
        `Đơn vị tính ${normalized} chưa được cấu hình`,
      );
    }
    if (!uom.isActive) {
      throw new BadRequestException(
        `Đơn vị tính ${normalized} đang ngưng sử dụng`,
      );
    }
    return uom;
  }

  private async ensureItemTypeActive(code: string) {
    const normalized = this.normalizeCode(code);
    const itemType = await this.itemTypeRepository.findOne({
      where: { code: normalized, isDeleted: false },
    });
    if (!itemType) {
      throw new BadRequestException(
        `Loại item ${normalized} chưa được cấu hình`,
      );
    }
    if (!itemType.isActive) {
      throw new BadRequestException(
        `Loại item ${normalized} đang ngưng sử dụng`,
      );
    }
    return itemType;
  }

  private async ensureTrackingCategoryActive(code?: string | null) {
    if (!code?.trim()) return null;
    const normalized = this.normalizeCode(code);
    const category = await this.trackingCategoryRepository.findOne({
      where: { code: normalized, isDeleted: false },
    });
    if (!category) {
      throw new BadRequestException(
        `Nhóm tracking ${normalized} chưa được cấu hình`,
      );
    }
    if (!category.isActive) {
      throw new BadRequestException(
        `Nhóm tracking ${normalized} đang ngưng sử dụng`,
      );
    }
    return category;
  }

  async softDeleteUom(id: string) {
    const existing = await this.uomRepository.findOneBy({ id });
    if (!existing) throw new NotFoundException(`UOM ${id} not found`);
    existing.isDeleted = true;
    await this.uomRepository.save(existing);
    return { message: 'Đã xóa đơn vị tính thành công', data: { id } };
  }

  async softDeleteItemType(id: string) {
    const existing = await this.itemTypeRepository.findOneBy({ id });
    if (!existing) throw new NotFoundException(`Item type ${id} not found`);
    existing.isDeleted = true;
    await this.itemTypeRepository.save(existing);
    return { message: 'Đã xóa loại item thành công', data: { id } };
  }

  async softDeleteItem(id: string) {
    const existing = await this.repository.findOneBy({ id });
    if (!existing)
      throw new NotFoundException(`Inventory item ${id} not found`);
    existing.isDeleted = true;
    await this.repository.save(existing);
    return { message: 'Đã xóa danh mục vật tư/kho thành công', data: { id } };
  }

  async create(dto: CreateInventoryItemDto) {
    const entity = this.repository.create({
      ...dto,
      uomId: dto.uomId,
      itemTypeId: dto.itemTypeId,
      status: dto.status || 'ACTIVE',
      note: dto.note || undefined,
      trackingPolicyId: dto.trackingPolicyId || null,
      trackingCategoryId: dto.trackingCategoryId || null,
      attributes: dto.attributes || [],
    } as Partial<ErpInventoryItem>);
    const data = await this.repository.save(entity);
    return { message: 'Tạo thành công', data };
  }

  async findAll(query: any) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    let baseWhere: any = { isDeleted: false };
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
      relations: ['uom', 'itemType'],
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

  async findOne(id: string) {
    const data = await this.repository.findOne({
      where: { id },
      relations: ['uom', 'itemType'],
    });
    if (!data) throw new NotFoundException('Không tìm thấy item');
    return { message: 'Lấy thông tin thành công', data };
  }

  async update(id: string, dto: UpdateInventoryItemDto) {
    const item = await this.repository.findOneBy({ id });
    if (!item) throw new NotFoundException('Không tìm thấy item');

    if (dto.uomId !== undefined) item.uomId = dto.uomId;
    if (dto.itemTypeId !== undefined) item.itemTypeId = dto.itemTypeId;
    if (dto.itemName !== undefined) item.itemName = dto.itemName;
    if (dto.sku !== undefined) item.sku = dto.sku;
    if (dto.note !== undefined) item.note = dto.note;
    if (dto.status !== undefined) item.status = dto.status;
    if (dto.trackingPolicyId !== undefined)
      item.trackingPolicyId = dto.trackingPolicyId;
    if (dto.trackingCategoryId !== undefined)
      item.trackingCategoryId = dto.trackingCategoryId;
    if (dto.attributes !== undefined) item.attributes = dto.attributes;

    await this.repository.save(item);
    const data = await this.repository.findOne({
      where: { id },
      relations: ['uom', 'itemType', 'trackingPolicy', 'trackingCategory'],
    });
    return { message: 'Cập nhật thành công', data };
  }

  async listUoms(query: InventoryMasterQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 100;
    const [items, total] = await this.uomRepository.findAndCount({
      where: this.buildMasterWhere(query),
      skip: (page - 1) * pageSize,
      take: pageSize,
      order: { code: 'ASC' },
    });
    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async createUom(dto: CreateUomDto) {
    const entity = this.uomRepository.create({
      code: this.normalizeCode(dto.code),
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      isActive: dto.isActive ?? true,
    });
    const data = await this.uomRepository.save(entity);
    return { message: 'Tạo đơn vị tính thành công', data };
  }

  async updateUom(id: string, dto: UpdateUomDto) {
    const existing = await this.uomRepository.findOneBy({ id });
    if (!existing) throw new NotFoundException(`UOM ${id} not found`);
    if (dto.code !== undefined) existing.code = this.normalizeCode(dto.code);
    if (dto.name !== undefined) existing.name = dto.name.trim();
    if (dto.description !== undefined)
      existing.description = dto.description?.trim() || null;
    if (dto.isActive !== undefined) existing.isActive = dto.isActive;
    const data = await this.uomRepository.save(existing);
    return { message: 'Cập nhật đơn vị tính thành công', data };
  }

  async listItemTypes(query: InventoryMasterQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 100;
    const [items, total] = await this.itemTypeRepository.findAndCount({
      where: this.buildMasterWhere(query),
      skip: (page - 1) * pageSize,
      take: pageSize,
      order: { code: 'ASC' },
    });
    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async createItemType(dto: CreateItemTypeDto) {
    const entity = this.itemTypeRepository.create({
      code: this.normalizeCode(dto.code),
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      isActive: dto.isActive ?? true,
    });
    const data = await this.itemTypeRepository.save(entity);
    return { message: 'Tạo loại item thành công', data };
  }

  async updateItemType(id: string, dto: UpdateItemTypeDto) {
    const existing = await this.itemTypeRepository.findOneBy({ id });
    if (!existing) throw new NotFoundException(`Item type ${id} not found`);
    if (dto.code !== undefined) existing.code = this.normalizeCode(dto.code);
    if (dto.name !== undefined) existing.name = dto.name.trim();
    if (dto.description !== undefined)
      existing.description = dto.description?.trim() || null;
    if (dto.isActive !== undefined) existing.isActive = dto.isActive;
    const data = await this.itemTypeRepository.save(existing);
    return { message: 'Cập nhật loại item thành công', data };
  }

  async listTrackingPolicies(query: InventoryMasterQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 100;
    const [items, total] = await this.trackingPolicyRepository.findAndCount({
      where: this.buildMasterWhere(query),
      skip: (page - 1) * pageSize,
      take: pageSize,
      order: { code: 'ASC' },
    });
    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async listTrackingCategories(query: InventoryMasterQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 100;
    const [items, total] = await this.trackingCategoryRepository.findAndCount({
      where: this.buildMasterWhere(query),
      skip: (page - 1) * pageSize,
      take: pageSize,
      order: { code: 'ASC' },
    });
    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async createTrackingCategory(dto: CreateTrackingCategoryDto) {
    const entity = this.trackingCategoryRepository.create({
      code: this.normalizeCode(dto.code),
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      isActive: dto.isActive ?? true,
    });
    const data = await this.trackingCategoryRepository.save(entity);
    return { message: 'Tạo nhóm tracking thành công', data };
  }

  async updateTrackingCategory(id: string, dto: UpdateTrackingCategoryDto) {
    const existing = await this.trackingCategoryRepository.findOneBy({ id });
    if (!existing)
      throw new NotFoundException(`Tracking category ${id} not found`);
    if (dto.code !== undefined) existing.code = this.normalizeCode(dto.code);
    if (dto.name !== undefined) existing.name = dto.name.trim();
    if (dto.description !== undefined)
      existing.description = dto.description?.trim() || null;
    if (dto.isActive !== undefined) existing.isActive = dto.isActive;
    const data = await this.trackingCategoryRepository.save(existing);
    return { message: 'Cập nhật nhóm tracking thành công', data };
  }

  async softDeleteTrackingCategory(id: string) {
    const existing = await this.trackingCategoryRepository.findOneBy({ id });
    if (!existing)
      throw new NotFoundException(`Tracking category ${id} not found`);
    existing.isDeleted = true;
    await this.trackingCategoryRepository.save(existing);
    return { message: 'Đã xóa nhóm tracking thành công', data: { id } };
  }

  /**
   * GET /inventory/items/:id/movements
   * Returns all inventory transactions for an item sorted by date ASC,
   * with a computed `balance_after` running total at each event.
   */
  async getMovements(id: string) {
    const item = await this.repository.findOneByOrFail({ id });
    const balance = await this.balanceRepository.findOne({
      where: { itemId: id } as never,
    });
    const currentOnHand = Number(balance?.qtyOnHand ?? 0);
    const txns = await this.txnRepository.find({
      where: { itemId: id } as never,
      order: { transactionDate: 'ASC', createdAt: 'ASC' } as never,
    });

    const receiptIds = txns
      .filter((t) => t.documentType === 'GOODS_RECEIPT' && t.documentId)
      .map((t) => t.documentId);
    const issueIds = txns
      .filter((t) => t.documentType === 'GOODS_ISSUE' && t.documentId)
      .map((t) => t.documentId);

    const docNoMap: Record<string, string> = {};

    if (receiptIds.length > 0) {
      const receipts = await this.dataSource.query(
        `SELECT id, receipt_no FROM public.erp_goods_receipts WHERE id = ANY($1)`,
        [receiptIds],
      );
      receipts.forEach((r) => (docNoMap[r.id] = r.receipt_no));
    }

    if (issueIds.length > 0) {
      const issues = await this.dataSource.query(
        `SELECT id, issue_no FROM public.erp_goods_issues WHERE id = ANY($1)`,
        [issueIds],
      );
      issues.forEach((i) => (docNoMap[i.id] = i.issue_no));
    }

    let running = 0;
    const movements = txns.map((txn) => {
      const qtyIn = Number(txn.qtyIn ?? 0);
      const qtyOut = Number(txn.qtyOut ?? 0);
      running = running + qtyIn - qtyOut;
      return {
        id: txn.id,
        transactionDate: txn.transactionDate,
        transactionType: txn.transactionType,
        documentType: txn.documentType,
        documentId: txn.documentId,
        documentNo: txn.documentId ? docNoMap[txn.documentId] : null,
        qtyIn,
        qtyOut,
        unitCost: txn.unitCost ? Number(txn.unitCost) : null,
        balanceAfter: Math.round(running * 1000) / 1000,
        notes: txn.notes,
        createdAt: txn.createdAt,
      };
    });

    return {
      message: 'Lịch sử xuất nhập kho',
      data: {
        item: {
          id: item.id,
          sku: item.sku,
          itemName: item.itemName,
          uom: item.uom,
          itemType: item.itemType,
        },
        currentOnHand,
        movements,
      },
    };
  }

  async getItemConnections(id: string) {
    const item = await this.repository.findOneByOrFail({ id });

    // Goods Receipts (limit 10)
    const grs = await this.dataSource.query(
      `
      SELECT g.id, g.receipt_no as "receiptNo", g.receipt_date as "receiptDate", g.status, SUM(l.qty_received) as qty,
             g.production_order_id as "productionOrderId", g.purchase_order_id as "purchaseOrderId"
      FROM public.erp_goods_receipts g
      JOIN public.erp_goods_receipt_lines l ON g.id = l.goods_receipt_id
      WHERE l.item_id = $1 AND g.is_deleted = false
      GROUP BY g.id, g.receipt_no, g.receipt_date, g.status, g.production_order_id, g.purchase_order_id
      ORDER BY g.receipt_date DESC, g.id DESC
      LIMIT 10
    `,
      [id],
    );

    // Goods Issues (limit 10)
    const gis = await this.dataSource.query(
      `
      SELECT g.id, g.issue_no as "issueNo", g.issue_date as "issueDate", g.status, SUM(l.qty_issued) as qty,
             g.production_order_id as "productionOrderId", g.sales_order_id as "salesOrderId"
      FROM public.erp_goods_issues g
      JOIN public.erp_goods_issue_lines l ON g.id = l.goods_issue_id
      WHERE l.item_id = $1 AND g.is_deleted = false
      GROUP BY g.id, g.issue_no, g.issue_date, g.status, g.production_order_id, g.sales_order_id
      ORDER BY g.issue_date DESC, g.id DESC
      LIMIT 10
    `,
      [id],
    );

    // Production Orders (limit 10)
    const pos = await this.dataSource.query(
      `
      SELECT p.id, p.reference_no as "orderNo", p.planned_start_date as "orderDate", p.status, 'FG' as role, p.qty_to_produce as qty, p.output_metadata->>'bomId' as "bomId"
      FROM public.erp_production_orders p
      WHERE p.finished_good_item_id = $1 AND p.is_deleted = false
      UNION
      SELECT p.id, p.reference_no as "orderNo", p.planned_start_date as "orderDate", p.status, 'COMPONENT' as role, SUM(m.qty_required) as qty, p.output_metadata->>'bomId' as "bomId"
      FROM public.erp_production_orders p
      JOIN public.erp_production_order_materials m ON p.id = m.production_order_id
      WHERE m.item_id = $1 AND p.is_deleted = false
      GROUP BY p.id, p.reference_no, p.planned_start_date, p.status, p.output_metadata
      LIMIT 10
    `,
      [id],
    );

    // BOMs (limit 10)
    const boms = await this.dataSource.query(
      `
      SELECT b.id, b.bom_code as "bomCode", b.bom_name as "bomName", b.status, 'FG' as role
      FROM public.erp_boms b
      WHERE b.finished_good_item_id = $1 AND b.is_deleted = false
      UNION
      SELECT DISTINCT b.id, b.bom_code as "bomCode", b.bom_name as "bomName", b.status, 'COMPONENT' as role
      FROM public.erp_boms b
      JOIN public.erp_bom_lines l ON b.id = l.bom_id
      WHERE l.component_item_id = $1 AND b.is_deleted = false
      LIMIT 10
    `,
      [id],
    );

    // Build Graph Nodes and Edges
    const nodes: any[] = [];
    const edges: any[] = [];

    // 1. Map lookups
    const grByPo = new Map<string, any[]>();
    grs.forEach((gr: any) => {
      if (gr.productionOrderId) {
        if (!grByPo.has(gr.productionOrderId))
          grByPo.set(gr.productionOrderId, []);
        grByPo.get(gr.productionOrderId)!.push(gr);
      }
    });

    const giByPo = new Map<string, any[]>();
    gis.forEach((gi: any) => {
      if (gi.productionOrderId) {
        if (!giByPo.has(gi.productionOrderId))
          giByPo.set(gi.productionOrderId, []);
        giByPo.get(gi.productionOrderId)!.push(gi);
      }
    });

    const poByBom = new Map<string, any[]>();
    pos.forEach((po: any) => {
      if (po.bomId) {
        if (!poByBom.has(po.bomId)) poByBom.set(po.bomId, []);
        poByBom.get(po.bomId)!.push(po);
      }
    });

    // 2. The Root Item Node
    nodes.push({
      id: `item-${item.id}`,
      // No module so it sits at root
      data: {
        nodeType: 'inventory_item',
        label: item.itemName,
        sublabel: item.sku,
        docId: item.id,
      },
    });

    // 3. Goods Receipts
    grs.forEach((gr: any) => {
      nodes.push({
        id: `gr-${gr.id}`,
        module: 'inventory',
        date: gr.receiptDate
          ? new Date(gr.receiptDate).toISOString()
          : undefined,
        data: {
          nodeType: 'goods_receipt',
          label: gr.receiptNo,
          status: gr.status,
          amount: Number(gr.qty || 0),
          docId: gr.id,
        },
      });
      // Removed edge to central item
    });

    // 4. Goods Issues
    gis.forEach((gi: any) => {
      nodes.push({
        id: `gi-${gi.id}`,
        module: 'inventory',
        date: gi.issueDate ? new Date(gi.issueDate).toISOString() : undefined,
        data: {
          nodeType: 'goods_issue',
          label: gi.issueNo,
          status: gi.status,
          amount: Number(gi.qty || 0),
          docId: gi.id,
        },
      });
      // Removed edge from central item
    });

    // 5. Production Orders
    pos.forEach((po: any) => {
      nodes.push({
        id: `po-${po.id}`,
        module: 'production',
        date: po.orderDate ? new Date(po.orderDate).toISOString() : undefined,
        data: {
          nodeType: 'production_order',
          label: po.orderNo,
          status: po.status,
          amount: Number(po.qty || 0),
          docId: po.id,
        },
      });

      if (po.role === 'FG') {
        const relatedGrs = grByPo.get(po.id);
        if (relatedGrs && relatedGrs.length > 0) {
          relatedGrs.forEach((gr) => {
            edges.push({
              id: `e-po-${po.id}-gr-${gr.id}`,
              source: `po-${po.id}`,
              target: `gr-${gr.id}`,
            });
          });
        }
      } else {
        const relatedGis = giByPo.get(po.id);
        if (relatedGis && relatedGis.length > 0) {
          relatedGis.forEach((gi) => {
            edges.push({
              id: `e-gi-${gi.id}-po-${po.id}`,
              source: `gi-${gi.id}`,
              target: `po-${po.id}`,
            });
          });
        }
      }
    });

    // 6. BOMs
    boms.forEach((bom: any) => {
      nodes.push({
        id: `bom-${bom.id}`,
        module: 'bom',
        data: {
          nodeType: 'bom',
          label: bom.bomCode,
          sublabel: bom.bomName,
          status: bom.status,
          docId: bom.id,
        },
      });

      const relatedPos = poByBom.get(bom.id);
      if (relatedPos && relatedPos.length > 0) {
        relatedPos.forEach((po) => {
          edges.push({
            id: `e-bom-${bom.id}-po-${po.id}`,
            source: `bom-${bom.id}`,
            target: `po-${po.id}`,
          });
        });
      }
    });

    // 7. Connect Root Item to Groups
    const populatedModules = new Set(
      nodes.filter((n) => n.module).map((n) => n.module),
    );
    populatedModules.forEach((mod) => {
      edges.push({
        id: `e-item-to-group-${mod}`,
        source: `item-${item.id}`,
        target: `group-${mod}`,
      });
    });

    const graph = await this.graphLayoutService.calculateSwimlaneLayout(
      nodes,
      edges,
    );

    return {
      message: 'Liên kết kho',
      data: {
        item: {
          id: item.id,
          sku: item.sku,
          itemName: item.itemName,
          uom: item.uom,
          itemType: item.itemType,
        },
        goodsReceipts: grs,
        goodsIssues: gis,
        productionOrders: pos,
        boms: boms,
        graph,
      },
    };
  }

  async listWarehouseVouchers(query: WarehouseVoucherQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    let params: any[] = [];
    let pIndex = 1;

    let receiptWhere = `g.is_deleted = false`;
    let issueWhere = `g.is_deleted = false`;

    if (query.dateFrom) {
      receiptWhere += ` AND g.receipt_date >= $${pIndex}`;
      issueWhere += ` AND g.issue_date >= $${pIndex}`;
      params.push(query.dateFrom);
      pIndex++;
    }
    if (query.dateTo) {
      receiptWhere += ` AND g.receipt_date <= $${pIndex}`;
      issueWhere += ` AND g.issue_date <= $${pIndex}`;
      params.push(
        query.dateTo.length === 10
          ? `${query.dateTo} 23:59:59.999`
          : query.dateTo,
      );
      pIndex++;
    }
    if (query.status) {
      receiptWhere += ` AND g.status = $${pIndex}`;
      issueWhere += ` AND g.status = $${pIndex}`;
      params.push(query.status);
      pIndex++;
    }
    if (query.partnerId) {
      receiptWhere += ` AND g.supplier_id = $${pIndex}`;
      issueWhere += ` AND g.customer_id = $${pIndex}`;
      params.push(query.partnerId);
      pIndex++;
    }
    if (query.search) {
      const s = `%${query.search}%`;
      receiptWhere += ` AND (g.receipt_no ILIKE $${pIndex} OR g.remarks ILIKE $${pIndex} OR bp.name ILIKE $${pIndex} OR bp.display_name ILIKE $${pIndex})`;
      issueWhere += ` AND (g.issue_no ILIKE $${pIndex} OR g.remarks ILIKE $${pIndex} OR bp.name ILIKE $${pIndex} OR bp.display_name ILIKE $${pIndex})`;
      params.push(s);
      pIndex++;
    }

    const typeFilter = query.type;
    const includeReceipts =
      !typeFilter || typeFilter === 'all' || typeFilter === 'receipt';
    const includeIssues =
      !typeFilter || typeFilter === 'all' || typeFilter === 'issue';

    const queries: string[] = [];

    if (includeReceipts) {
      queries.push(`
        SELECT g.id, g.receipt_no as "voucherNo", g.receipt_date as "date", 'receipt' as "type",
               g.status, g.remarks, g.supplier_id as "partnerId", COALESCE(bp.display_name, bp.name) as "partnerName",
               g.created_at as "createdAt",
               po.po_no as "poNo",
               (SELECT COALESCE(SUM(qty_received), 0) FROM public.erp_goods_receipt_lines rl WHERE rl.goods_receipt_id = g.id) as "totalQty"
        FROM public.erp_goods_receipts g
        LEFT JOIN public.erp_business_partners bp ON g.supplier_id = bp.id
        LEFT JOIN public.erp_purchase_orders po ON g.purchase_order_id = po.id
        WHERE ${receiptWhere}
      `);
    }

    if (includeIssues) {
      queries.push(`
        SELECT g.id, g.issue_no as "voucherNo", g.issue_date as "date", 'issue' as "type",
               g.status, g.remarks, g.customer_id as "partnerId", COALESCE(bp.display_name, bp.name) as "partnerName",
               g.created_at as "createdAt",
               NULL as "poNo",
               (SELECT COALESCE(SUM(qty_issued), 0) FROM public.erp_goods_issue_lines il WHERE il.goods_issue_id = g.id) as "totalQty"
        FROM public.erp_goods_issues g
        LEFT JOIN public.erp_business_partners bp ON g.customer_id = bp.id
        WHERE ${issueWhere}
      `);
    }

    if (queries.length === 0) {
      return { items: [], total: 0, page, pageSize, totalPages: 0 };
    }

    const unionQuery = queries.join(' UNION ALL ');

    // Sorting
    let sortColumn = 'date';
    let sortDirection = 'DESC';

    if (query.sort) {
      let sortField = query.sort;
      if (sortField.startsWith('-')) {
        sortDirection = 'DESC';
        sortField = sortField.substring(1);
      } else {
        sortDirection = 'ASC';
      }
      if (sortField === 'date') sortColumn = '"date"';
      else if (sortField === 'voucherNo') sortColumn = '"voucherNo"';
      else if (sortField === 'status') sortColumn = 'status';
    }

    const countQuery = `SELECT COUNT(*) as total FROM (${unionQuery}) as combined`;
    const dataQuery = `
      SELECT * FROM (${unionQuery}) as combined
      ORDER BY ${sortColumn} ${sortDirection}, "createdAt" DESC
      LIMIT $${pIndex} OFFSET $${pIndex + 1}
    `;

    const countResult = await this.dataSource.query(countQuery, params);
    const total = parseInt(countResult[0]?.total ?? '0', 10);

    const dataParams = [...params, pageSize, (page - 1) * pageSize];
    const items = await this.dataSource.query(dataQuery, dataParams);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async listSerials(query: InventorySerialQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const qb = this.serialRepository
      .createQueryBuilder('s')
      .select([
        's.id as s_id',
        's.serial_no as s_serial_no',
        's.item_id as s_item_id',
        's.vin_id as s_vin_id',
        's.custom_id as s_custom_id',
        's.created_at as s_created_at',
        's.updated_at as s_updated_at',
        's.lot_no as s_lot_no',
        's.notes as s_notes',
        's.attributes as s_attributes',
        's.status as s_status',
        's.sales_order_line_id as s_sales_order_line_id',
        'so.id as so_id',
        'so.so_no as so_no',
        'so.expected_delivery_date as so_delivery_date',
        'i.id as i_id',
        'i.sku as i_sku',
        'i.item_name as i_item_name',
        'i.item_type_id as i_item_type',
        'i.tracking_policy_id as i_tracking_policy_id',
        'i.tracking_category_id as i_tracking_category_id',
        'v.vin_no as v_vin_no',
        'v.engine_no as v_engine_no',
        'tp.name as tp_name',
      ])
      .leftJoin('erp_inventory_items', 'i', 's.item_id = i.id')
      .leftJoin('erp_vehicles', 'v', 's.vin_id = v.id')
      .leftJoin('erp_tracking_policies', 'tp', 'i.tracking_policy_id = tp.id')
      .leftJoin(
        'erp_sales_order_lines',
        'sol',
        's.sales_order_line_id = sol.id',
      )
      .leftJoin('erp_sales_orders', 'so', 'sol.sales_order_id = so.id');

    if (query.ids) {
      const idsArr = Array.isArray(query.ids)
        ? query.ids
        : query.ids.split(',');
      if (idsArr.length > 0) {
        qb.andWhere('s.id IN (:...ids)', { ids: idsArr });
      }
    }

    if (query.missingSerial === true || query.missingSerial === 'true') {
      qb.andWhere('s.serial_no IS NULL');
    }

    if (query.itemId) {
      qb.andWhere('s.item_id = :itemId', { itemId: query.itemId });
    }

    if (query.status) {
      qb.andWhere('s.status = :status', { status: query.status });
    }

    if (query.salesOrderLineId) {
      qb.andWhere('s.sales_order_line_id = :solId', {
        solId: query.salesOrderLineId,
      });
    }

    if (query.itemTypeId) {
      qb.andWhere('i.item_type_id = :itemType', { itemType: query.itemTypeId });
    } else {
      // If no itemType is provided, we can either default to FG or return all.
      // Based on user request, track ANY item that allows tracking, so no default filter needed here.
    }

    if (query.trackingPolicy) {
      qb.andWhere(
        `EXISTS (
          SELECT 1 FROM erp_tracking_policies tp
          WHERE tp.id = i.tracking_policy_id
          AND tp.code = :trackingPolicy
        )`,
        { trackingPolicy: query.trackingPolicy },
      );
    } else {
      // By default, only return items with a tracking policy assigned (not NONE/null)
      qb.andWhere(
        `EXISTS (
          SELECT 1 FROM erp_tracking_policies tp
          WHERE tp.id = i.tracking_policy_id
          AND tp.code != 'NONE'
        )`,
      );
    }

    if (query.search) {
      qb.andWhere(
        '(s.serial_no ILIKE :search OR i.item_name ILIKE :search OR i.sku ILIKE :search OR v.vin_no ILIKE :search OR v.engine_no ILIKE :search OR so.so_no ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    // sort
    const validSortFields = ['created_at', 'serial_no'];
    let sortColumn = 's.created_at';
    let sortDirection: 'ASC' | 'DESC' = 'DESC';
    if (query.sort && query.sort.length > 0) {
      let sortField = query.sort[0];
      if (sortField.startsWith('-')) {
        sortDirection = 'DESC';
        sortField = sortField.substring(1);
      } else {
        sortDirection = 'ASC';
      }
      if (sortField === 'serial_no') sortColumn = 's.serial_no';
      if (sortField === 'created_at') sortColumn = 's.created_at';
    }

    qb.orderBy(sortColumn, sortDirection);
    qb.offset((page - 1) * pageSize).limit(pageSize);

    const [itemsRaw, total] = await Promise.all([
      qb.getRawMany(),
      qb.getCount(),
    ]);
    const fixTimezone = (dateOrString: any): string | null => {
      if (!dateOrString) return null;
      if (typeof dateOrString === 'string') {
        let s = dateOrString;
        if (!s.endsWith('Z') && !s.match(/[+-]\d{2}:\d{2}$/)) {
          if (s.includes(' ')) s = s.replace(' ', 'T');
          return s + 'Z';
        }
        return s;
      }
      if (dateOrString instanceof Date) {
        const y = dateOrString.getFullYear();
        const m = String(dateOrString.getMonth() + 1).padStart(2, '0');
        const d = String(dateOrString.getDate()).padStart(2, '0');
        const h = String(dateOrString.getHours()).padStart(2, '0');
        const min = String(dateOrString.getMinutes()).padStart(2, '0');
        const sec = String(dateOrString.getSeconds()).padStart(2, '0');
        const ms = String(dateOrString.getMilliseconds()).padStart(3, '0');
        return `${y}-${m}-${d}T${h}:${min}:${sec}.${ms}Z`;
      }
      return null;
    };

    // Map raw results to standard format
    const items = itemsRaw.map((raw) => ({
      id: raw.s_id,
      serialNo: raw.s_serial_no,
      itemId: raw.s_item_id,
      vinId: raw.s_vin_id,
      vinNo: raw.v_vin_no,
      engineNo: raw.v_engine_no,
      customId: raw.s_custom_id,
      lotNo: raw.s_lot_no,
      notes: raw.s_notes,
      attributes: raw.s_attributes,
      status: raw.s_status,
      salesOrderLineId: raw.s_sales_order_line_id,
      soId: raw.so_id,
      soNo: raw.so_no,
      createdAt: fixTimezone(raw.s_created_at),
      updatedAt: fixTimezone(raw.s_updated_at),
      item: {
        id: raw.i_id,
        sku: raw.i_sku,
        itemName: raw.i_item_name,
        itemType: raw.i_item_type,
        trackingPolicyId: raw.i_tracking_policy_id,
        trackingCategoryId: raw.i_tracking_category_id,
        trackingPolicyName: raw.tp_name,
      },
      lifecycle: {
        deliveryDate: raw.so_delivery_date
          ? fixTimezone(raw.so_delivery_date)
          : null,
      },
    }));

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getSerial(id: string) {
    const serial = await this.serialRepository.findOne({
      where: { id },
    });
    if (!serial)
      throw new NotFoundException(`Tracking serial '${id}' không tồn tại`);

    // Fetch related item manually since it's not a direct TypeORM relation mapping yet
    const itemRaw = await this.serialRepository.manager.query(
      `
      SELECT i.id, i.sku, i.item_name, i.item_type_id, i.tracking_policy_id, i.tracking_category_id, tp.name as tp_name
      FROM erp_inventory_items i
      LEFT JOIN erp_tracking_policies tp ON i.tracking_policy_id = tp.id
      WHERE i.id = $1
      `,
      [serial.itemId],
    );

    let vinNo = null;
    let engineNo = null;
    if (serial.vinId) {
      const vinRaw = await this.serialRepository.manager.query(
        `SELECT vin_no, engine_no FROM erp_vehicles WHERE id = $1`,
        [serial.vinId],
      );
      if (vinRaw[0]) {
        vinNo = vinRaw[0].vin_no;
        engineNo = vinRaw[0].engine_no;
      }
    }

    const itemObj = itemRaw[0]
      ? {
          id: itemRaw[0].id,
          sku: itemRaw[0].sku,
          itemName: itemRaw[0].item_name,
          itemType: itemRaw[0].item_type_id,
          trackingPolicyId: itemRaw[0].tracking_policy_id,
          trackingCategoryId: itemRaw[0].tracking_category_id,
          trackingPolicyName: itemRaw[0].tp_name,
        }
      : null;

    const result: any = {
      id: serial.id,
      serialNo: serial.serialNo,
      itemId: serial.itemId,
      vinId: serial.vinId,
      vinNo,
      engineNo,
      customId: serial.customId,
      lotNo: serial.lotNo,
      notes: serial.notes,
      attributes: serial.attributes,
      createdAt: serial.createdAt,
      updatedAt: serial.updatedAt,
      item: itemObj,
      lifecycle: null,
    };

    const lifecycleRepo =
      this.serialRepository.manager.getRepository(ErpSerialLifecycle);
    const lifecycle = await lifecycleRepo.findOne({ where: { serialId: id } });
    if (lifecycle) {
      result.lifecycle = lifecycle;
    }

    return result;
  }

  async updateSerial(id: string, dto: UpdateInventorySerialDto) {
    const serial = await this.serialRepository.findOne({ where: { id } });
    if (!serial) {
      throw new NotFoundException(`Tracking serial '${id}' không tồn tại`);
    }
    if (dto.notes !== undefined) serial.notes = dto.notes;
    if (dto.attributes !== undefined) serial.attributes = dto.attributes;
    await this.serialRepository.save(serial);
    return serial;
  }

  async confirmDelivery(serialId: string, dto: ConfirmDeliveryDto) {
    return this.dataSource.transaction(async (manager) => {
      const serialRepo = manager.getRepository(ErpInventoryTrackingSerial);
      const vehicleRepo = manager.getRepository(ErpVehicle);
      const lifecycleRepo = manager.getRepository(ErpSerialLifecycle);
      const soRepo = manager.getRepository(ErpSalesOrder);
      const soLineRepo = manager.getRepository(ErpSalesOrderLine);

      const serial = await serialRepo.findOne({ where: { id: serialId } });
      if (!serial) {
        throw new NotFoundException(
          `Tracking serial '${serialId}' không tồn tại`,
        );
      }

      const lifecycle = await lifecycleRepo.findOne({ where: { serialId } });
      if (!lifecycle) {
        throw new NotFoundException(
          `Lifecycle cho serial '${serialId}' không tồn tại`,
        );
      }
      lifecycle.deliveryDate = dto.deliveryDate;
      if (dto.notes !== undefined) {
        lifecycle.notes = dto.notes;
      }
      await lifecycleRepo.save(lifecycle);

      serial.status = 'SOLD';
      await serialRepo.save(serial);

      if (serial.vinId) {
        const vehicle = await vehicleRepo.findOne({
          where: { id: serial.vinId },
        });
        if (vehicle) {
          vehicle.status = 'SOLD';
          await vehicleRepo.save(vehicle);
        }
      }

      if (serial.salesOrderLineId) {
        const soLine = await soLineRepo.findOne({
          where: { id: serial.salesOrderLineId },
        });
        if (soLine?.salesOrderId) {
          const so = await soRepo.findOne({
            where: { id: soLine.salesOrderId },
          });
          if (so) {
            const lines = await soLineRepo.find({
              where: { salesOrderId: so.id },
            });
            const lineIds = lines.map((l) => l.id);
            if (lineIds.length > 0) {
              const allSerials = await serialRepo.find({
                where: { salesOrderLineId: In(lineIds) },
              });
              const anyDelivering = allSerials.some(
                (s) => s.status === 'DELIVERING',
              );
              if (anyDelivering) {
                so.status = 'DELIVERING';
              } else {
                so.status = 'DELIVERED';
              }
              await soRepo.save(so);
            }
          }
        }
      }

      return lifecycle;
    });
  }

  async updateSerialLifecycle(serialId: string, dto: UpdateSerialLifecycleDto) {
    const lifecycleRepo =
      this.serialRepository.manager.getRepository(ErpSerialLifecycle);
    const lifecycle = await lifecycleRepo.findOne({ where: { serialId } });
    if (!lifecycle) {
      throw new NotFoundException(
        `Lifecycle cho serial '${serialId}' không tồn tại`,
      );
    }

    if (dto.customerName !== undefined)
      lifecycle.customerName = dto.customerName;
    if (dto.customerPhone !== undefined)
      lifecycle.customerPhone = dto.customerPhone;
    if (dto.customerAddress !== undefined)
      lifecycle.customerAddress = dto.customerAddress;
    if (dto.customerIdNumber !== undefined)
      lifecycle.customerIdNumber = dto.customerIdNumber;
    if (dto.warrantyActivatedAt !== undefined) {
      lifecycle.warrantyActivatedAt = dto.warrantyActivatedAt
        ? new Date(dto.warrantyActivatedAt)
        : null;
    }
    if (dto.warrantyMonths !== undefined)
      lifecycle.warrantyMonths = dto.warrantyMonths;
    if (dto.notes !== undefined) lifecycle.notes = dto.notes;
    if (dto.dealerName !== undefined) {
      lifecycle.attributes = lifecycle.attributes || {};
      lifecycle.attributes.dealer_name = dto.dealerName;
    }
    if (dto.dealerId !== undefined) {
      lifecycle.dealerId = dto.dealerId ? dto.dealerId : null;
    }

    // Recalculate warranty_end_date if needed
    if (lifecycle.warrantyActivatedAt && lifecycle.warrantyMonths) {
      const endDate = new Date(lifecycle.warrantyActivatedAt);
      endDate.setMonth(endDate.getMonth() + lifecycle.warrantyMonths);
      lifecycle.warrantyEndDate = endDate.toISOString().split('T')[0];
    }

    await lifecycleRepo.save(lifecycle);
    return lifecycle;
  }

  async getSerialLifecycleColumnOptions(
    column: string,
    search: string,
    page: number = 1,
    pageSize: number = 20,
    filtersStr?: string,
  ) {
    let selectField = '';
    let isDateColumn = false;

    if (column === 'expectedDeliveryDate') {
      selectField = "TO_CHAR(so.expected_delivery_date, 'YYYY-MM-DD')";
      isDateColumn = true;
    } else if (column === 'deliveryDate') {
      selectField = "TO_CHAR(l.delivery_date, 'YYYY-MM-DD')";
      isDateColumn = true;
    } else if (column === 'itemName') selectField = 'i.item_name';
    else if (column === 'serialNo') selectField = 's.serial_no';
    else if (column === 'vinNo') selectField = 'v.vin_no';
    else if (column === 'engineNo') selectField = 'v.engine_no';
    else if (column === 'soNo') selectField = 'so.so_no';
    else if (column === 'customerName') selectField = 'l.customer_name';
    else if (column === 'activationDate') {
      selectField = "TO_CHAR(l.warranty_activated_at, 'YYYY-MM-DD')";
      isDateColumn = true;
    } else if (column === 'dealerName') {
      selectField = "l.attributes->>'dealer_name'";
    } else if (column === 'color') {
      selectField = "s.attributes->>'color'";
    } else {
      return { items: [], total: 0, page, pageSize, totalPages: 0 };
    }

    let sql = `
      SELECT DISTINCT ${selectField} as value
      FROM erp_serial_lifecycles l
      JOIN erp_inventory_tracking_serials s ON l.serial_id = s.id
      JOIN erp_inventory_items i ON s.item_id = i.id
      LEFT JOIN erp_vehicles v ON s.vin_id = v.id
      LEFT JOIN erp_sales_orders so ON l.sales_order_id = so.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIdx = 1;

    if (isDateColumn) {
      sql += ` AND ${selectField} IS NOT NULL AND ${selectField} != ''`;
    } else {
      sql += ` AND ${selectField} IS NOT NULL AND CAST(${selectField} AS TEXT) != ''`;
    }

    if (filtersStr) {
      try {
        const filters = JSON.parse(filtersStr) as Record<string, string[]>;
        for (const [col, vals] of Object.entries(filters)) {
          if (!vals || vals.length === 0) continue;
          if (col === column) continue;

          let filterField = '';
          if (col === 'expectedDeliveryDate')
            filterField = "TO_CHAR(so.expected_delivery_date, 'YYYY-MM-DD')";
          else if (col === 'deliveryDate')
            filterField = "TO_CHAR(l.delivery_date, 'YYYY-MM-DD')";
          else if (col === 'itemName') filterField = 'i.item_name';
          else if (col === 'serialNo') filterField = 's.serial_no';
          else if (col === 'vinNo') filterField = 'v.vin_no';
          else if (col === 'engineNo') filterField = 'v.engine_no';
          else if (col === 'soNo') filterField = 'so.so_no';
          else if (col === 'customerName') filterField = 'l.customer_name';
          else if (col === 'color') filterField = "s.attributes->>'color'";
          else if (col === 'activationDate')
            filterField = "TO_CHAR(l.warranty_activated_at, 'YYYY-MM-DD')";
          else if (col === 'dealerName')
            filterField = "l.attributes->>'dealer_name'";

          if (filterField) {
            const placeholders = vals.map(() => `$${paramIdx++}`).join(', ');
            sql += ` AND CAST(${filterField} AS TEXT) IN (${placeholders})`;
            params.push(...vals);
          }
        }
      } catch (e) {}
    }

    if (search) {
      const keywords = String(search)
        .split(';')
        .map((k) => k.trim())
        .filter((k) => k);
      if (keywords.length > 0) {
        const conditions: string[] = [];
        for (const kw of keywords) {
          conditions.push(`CAST(${selectField} AS TEXT) ILIKE $${paramIdx++}`);
          params.push(`%${kw}%`);
        }
        sql += ` AND (${conditions.join(' OR ')})`;
      }
    }

    // Count Total
    const countSql = `SELECT COUNT(*) as cnt FROM (${sql}) as t`;
    const countRes = await this.serialRepository.manager.query(
      countSql,
      params,
    );
    const total = parseInt(countRes[0]?.cnt || '0', 10);

    // Get Data
    sql += ` ORDER BY value ASC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    params.push(pageSize, (page - 1) * pageSize);
    const results = await this.serialRepository.manager.query(sql, params);

    return {
      items: results.map((r: any) => String(r.value)).filter(Boolean),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async listSerialLifecycles(query: any) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 50;
    const skip = (page - 1) * pageSize;

    let sql = `
      SELECT 
        l.id as lifecycle_id, l.status, l.delivery_date, l.customer_name, l.customer_phone,
        l.warranty_activated_at, l.warranty_months, l.warranty_end_date, l.dealer_id, l.sales_order_id, l.attributes,
        s.id as serial_id, s.serial_no, s.item_id, s.vin_id, s.attributes as tracking_attributes,
        i.sku, i.item_name,
        v.vin_no, v.engine_no,
        so.so_no, so.expected_delivery_date as expected_delivery_date
      FROM erp_serial_lifecycles l
      JOIN erp_inventory_tracking_serials s ON l.serial_id = s.id
      JOIN erp_inventory_items i ON s.item_id = i.id
      LEFT JOIN erp_vehicles v ON s.vin_id = v.id
      LEFT JOIN erp_sales_orders so ON l.sales_order_id = so.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIdx = 1;

    if (query.status) {
      sql += ` AND s.status = $${paramIdx++}`;
      params.push(query.status);
    }

    if (query.deliveryDateFrom) {
      sql += ` AND l.delivery_date >= $${paramIdx++}`;
      params.push(query.deliveryDateFrom);
    }

    if (query.deliveryDateTo) {
      sql += ` AND l.delivery_date <= $${paramIdx++}`;
      params.push(query.deliveryDateTo);
    }

    if (query.search) {
      sql += ` AND (
        s.serial_no ILIKE $${paramIdx} OR 
        v.vin_no ILIKE $${paramIdx} OR 
        l.customer_name ILIKE $${paramIdx} OR 
        l.customer_phone ILIKE $${paramIdx}
      )`;
      params.push(`%${query.search}%`);
      paramIdx++;
    }

    if (query.warrantyStatus === 'NOT_ACTIVATED') {
      sql += ` AND l.warranty_activated_at IS NULL`;
    } else if (query.warrantyStatus === 'ACTIVE') {
      sql += ` AND l.warranty_activated_at IS NOT NULL AND (l.warranty_end_date IS NULL OR l.warranty_end_date >= CURRENT_DATE)`;
    } else if (query.warrantyStatus === 'EXPIRED') {
      sql += ` AND l.warranty_end_date < CURRENT_DATE`;
    }

    if (query.dealerId) {
      sql += ` AND l.dealer_id = $${paramIdx++}`;
      params.push(query.dealerId);
    }

    // Dynamic Column Filters
    if (query.column_filters) {
      try {
        const filters = JSON.parse(query.column_filters);
        for (const [col, vals] of Object.entries(filters)) {
          const valsArray = vals as string[];
          if (!valsArray || valsArray.length === 0) continue;

          let filterField = '';
          if (col === 'expectedDeliveryDate')
            filterField = "TO_CHAR(so.expected_delivery_date, 'YYYY-MM-DD')";
          else if (col === 'deliveryDate')
            filterField = "TO_CHAR(l.delivery_date, 'YYYY-MM-DD')";
          else if (col === 'itemName') filterField = 'i.item_name';
          else if (col === 'serialNo') filterField = 's.serial_no';
          else if (col === 'vinNo') filterField = 'v.vin_no';
          else if (col === 'engineNo') filterField = 'v.engine_no';
          else if (col === 'soNo') filterField = 'so.so_no';
          else if (col === 'customerName') filterField = 'l.customer_name';
          else if (col === 'color') filterField = "s.attributes->>'color'";
          else if (col === 'activationDate')
            filterField = "TO_CHAR(l.warranty_activated_at, 'YYYY-MM-DD')";
          else if (col === 'dealerName')
            filterField = "l.attributes->>'dealer_name'";
          else if (col === 'warrantyActivatedAt') {
            const conditions: string[] = [];
            if (valsArray.includes('ACTIVE')) {
              conditions.push(
                `(l.warranty_activated_at IS NOT NULL AND (l.warranty_end_date IS NULL OR l.warranty_end_date >= CURRENT_DATE))`,
              );
            }
            if (valsArray.includes('EXPIRED')) {
              conditions.push(`(l.warranty_end_date < CURRENT_DATE)`);
            }
            if (valsArray.includes('NOT_ACTIVATED')) {
              conditions.push(`(l.warranty_activated_at IS NULL)`);
            }
            if (conditions.length > 0) {
              sql += ` AND (${conditions.join(' OR ')})`;
            }
            continue;
          }

          if (filterField) {
            const placeholders = valsArray
              .map(() => `$${paramIdx++}`)
              .join(', ');
            sql += ` AND CAST(${filterField} AS TEXT) IN (${placeholders})`;
            params.push(...valsArray);
          }
        }
      } catch (e) {}
    }

    // Dynamic Column Search
    if (query.column_search) {
      try {
        const searchFilters = JSON.parse(query.column_search);
        for (const [col, val] of Object.entries(searchFilters)) {
          if (!val) continue;

          let searchField = '';
          if (col === 'expectedDeliveryDate')
            searchField = "TO_CHAR(so.expected_delivery_date, 'YYYY-MM-DD')";
          else if (col === 'deliveryDate')
            searchField = "TO_CHAR(l.delivery_date, 'YYYY-MM-DD')";
          else if (col === 'itemName') searchField = 'i.item_name';
          else if (col === 'serialNo') searchField = 's.serial_no';
          else if (col === 'vinNo') searchField = 'v.vin_no';
          else if (col === 'engineNo') searchField = 'v.engine_no';
          else if (col === 'soNo') searchField = 'so.so_no';
          else if (col === 'customerName') searchField = 'l.customer_name';
          else if (col === 'color') searchField = "s.attributes->>'color'";
          else if (col === 'activationDate')
            searchField = "TO_CHAR(l.warranty_activated_at, 'YYYY-MM-DD')";
          else if (col === 'dealerName')
            searchField = "l.attributes->>'dealer_name'";

          if (searchField) {
            // Apply multi keyword filter logic using ';' as separator and OR logic
            const keywords = (val as string)
              .split(';')
              .map((k) => k.trim())
              .filter((k) => k);
            if (keywords.length > 0) {
              const conditions: string[] = [];
              for (const kw of keywords) {
                conditions.push(
                  `CAST(${searchField} AS TEXT) ILIKE $${paramIdx++}`,
                );
                params.push(`%${kw}%`);
              }
              sql += ` AND (${conditions.join(' OR ')})`;
            }
          }
        }
      } catch (e) {}
    }

    // Count
    const countSql = `SELECT COUNT(*) as count FROM (${sql}) as t`;
    const countRes = await this.serialRepository.manager.query(
      countSql,
      params,
    );
    const total = parseInt(countRes[0].count, 10);

    // Data
    let orderByClause =
      'ORDER BY l.delivery_date DESC NULLS LAST, l.created_at DESC';
    if (query.sortField && query.sortOrder) {
      const dir = query.sortOrder === 'asc' ? 'ASC' : 'DESC';
      let sortCol = '';
      switch (query.sortField) {
        case 'deliveryDate':
          sortCol = 'l.delivery_date';
          break;
        case 'expectedDeliveryDate':
          sortCol = 'so.expected_delivery_date';
          break;
        case 'activationDate':
          sortCol = 'l.warranty_activated_at';
          break;
      }
      if (sortCol) {
        orderByClause = `ORDER BY ${sortCol} ${dir} NULLS LAST, l.created_at DESC`;
      }
    }

    sql += ` ${orderByClause} LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    params.push(pageSize, skip);

    const data = await this.serialRepository.manager.query(sql, params);

    // Map to camelCase
    const items = data.map((row: any) => ({
      lifecycleId: row.lifecycle_id,
      serialId: row.serial_id,
      status: row.status,
      deliveryDate: row.delivery_date,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      warrantyActivatedAt: row.warranty_activated_at,
      warrantyMonths: row.warranty_months,
      warrantyEndDate: row.warranty_end_date,
      serialNo: row.serial_no,
      itemId: row.item_id,
      sku: row.sku,
      itemName: row.item_name,
      vinNo: row.vin_no,
      engineNo: row.engine_no,
      salesOrderId: row.sales_order_id,
      soNo: row.so_no,
      expectedDeliveryDate: row.expected_delivery_date,
      dealerId: row.dealer_id,
      dealerName: row.attributes?.dealer_name || null,
      trackingAttributes: row.tracking_attributes || null,
      warrantyCode: row.warranty_activated_at
        ? `WRN-${new Date(row.warranty_activated_at).toISOString().slice(0, 10).replace(/-/g, '')}-${(row.vin_no || row.serial_no || '000000').slice(-6)}`
        : null,
    }));

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getDashboardStats(query: InventoryDashboardQueryDto) {
    const start = query.startDate ? new Date(query.startDate) : null;
    const end = query.endDate ? new Date(query.endDate) : null;
    if (end) end.setHours(23, 59, 59, 999);

    // Find BOM 'xe đen'
    const boms = await this.dataSource.query(
      `SELECT id FROM erp_boms WHERE bom_name ILIKE '%xe đen%' OR bom_code ILIKE '%den%' OR bom_code ILIKE '%black%' LIMIT 1`,
    );
    const bomId = boms.length ? boms[0].id : null;
    let bomLines: { component_item_id: string; qty_required: string }[] = [];
    if (bomId) {
      bomLines = await this.dataSource.query(
        `SELECT component_item_id, qty_required FROM erp_bom_lines WHERE bom_id = $1`,
        [bomId],
      );
    }
    const lowStockThresholdMap = new Map<string, number>();
    for (const line of bomLines) {
      if (line.component_item_id) {
        lowStockThresholdMap.set(
          line.component_item_id,
          parseFloat(line.qty_required) * 5,
        );
      }
    }

    // Fetch all active items with their balances
    const itemParams: any[] = [];
    let itemWhere = `WHERE i.is_deleted = false`;
    if (query.warehouseCode) {
      itemParams.push(query.warehouseCode);
      itemWhere += ` AND b.warehouse_code = $1`;
    }

    const items = await this.dataSource.query(
      `
      SELECT 
        i.id as item_id, i.sku, i.item_name as item_name, 
        t.id as type_id, t.name as type_name,
        COALESCE(b.qty_on_hand, 0) as qty,
        COALESCE(b.avg_unit_cost, 0) as cost,
        (
          SELECT MAX(transaction_date) 
          FROM erp_inventory_transactions txn 
          WHERE txn.item_id = i.id AND txn.transaction_type = 'ISSUE'
        ) as last_issue_date
      FROM erp_inventory_items i
      LEFT JOIN erp_inventory_balances b ON i.id = b.item_id
      LEFT JOIN erp_item_types t ON i.item_type_id = t.id
      ${itemWhere}
    `,
      itemParams,
    );

    let totalStockValue = 0;
    let zeroStockCount = 0;
    let lowStockCount = 0;
    const typeBreakdownMap = new Map<
      string,
      { id: string; name: string; qty: number; value: number }
    >();
    const alertItems: any[] = [];
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    for (const item of items) {
      const qty = parseFloat(item.qty);
      const cost = parseFloat(item.cost);
      const value = qty * cost;
      totalStockValue += value;

      if (item.type_id) {
        if (!typeBreakdownMap.has(item.type_id)) {
          typeBreakdownMap.set(item.type_id, {
            id: item.type_id,
            name: item.type_name,
            qty: 0,
            value: 0,
          });
        }
        typeBreakdownMap.get(item.type_id)!.value += value;
        typeBreakdownMap.get(item.type_id)!.qty += qty;
      }

      const threshold = lowStockThresholdMap.get(item.item_id) || 5;

      if (qty <= 0) {
        zeroStockCount++;
        alertItems.push({
          itemId: item.item_id,
          sku: item.sku,
          itemName: item.item_name,
          qtyOnHand: qty,
          lastIssueDate: item.last_issue_date,
          alertType: 'zero_stock',
        });
      } else if (qty < threshold) {
        lowStockCount++;
        alertItems.push({
          itemId: item.item_id,
          sku: item.sku,
          itemName: item.item_name,
          qtyOnHand: qty,
          lastIssueDate: item.last_issue_date,
          alertType: 'low_stock',
        });
      } else if (
        !item.last_issue_date ||
        new Date(item.last_issue_date) < ninetyDaysAgo
      ) {
        alertItems.push({
          itemId: item.item_id,
          sku: item.sku,
          itemName: item.item_name,
          qtyOnHand: qty,
          lastIssueDate: item.last_issue_date,
          alertType: 'slow_moving',
        });
      }
    }

    alertItems.sort((a, b) => a.qtyOnHand - b.qtyOnHand);

    const totalStockQty = Array.from(typeBreakdownMap.values()).reduce(
      (acc, t) => acc + t.qty,
      0,
    );
    const typeBreakdown = Array.from(typeBreakdownMap.values())
      .map((t) => ({
        itemTypeId: t.id,
        itemTypeName: t.name,
        stockValue: t.value,
        stockQty: t.qty,
        percentage: totalStockQty > 0 ? (t.qty / totalStockQty) * 100 : 0,
      }))
      .sort((a, b) => b.stockQty - a.stockQty);

    const topStockItems = [...items]
      .sort(
        (a, b) =>
          parseFloat(b.qty) * parseFloat(b.cost) -
          parseFloat(a.qty) * parseFloat(a.cost),
      )
      .slice(0, 20)
      .map((item) => ({
        itemId: item.item_id,
        sku: item.sku,
        itemName: item.item_name,
        itemTypeName: item.type_name,
        qtyOnHand: parseFloat(item.qty),
        unitCost: parseFloat(item.cost),
        stockValue: parseFloat(item.qty) * parseFloat(item.cost),
      }));

    // Transactions for Trend & Issued Items
    let txnWhere = `WHERE 1=1`;
    const txnParams: any[] = [];
    if (start) {
      txnParams.push(start);
      txnWhere += ` AND transaction_date >= $${txnParams.length}`;
    }
    if (end) {
      txnParams.push(end);
      txnWhere += ` AND transaction_date <= $${txnParams.length}`;
    }
    if (query.warehouseCode) {
      txnParams.push(query.warehouseCode);
      txnWhere += ` AND warehouse_code = $${txnParams.length}`;
    }

    const txns = await this.dataSource.query(
      `
      SELECT 
        transaction_type, document_id, item_id, qty_in, qty_out, unit_cost, transaction_date
      FROM erp_inventory_transactions
      ${txnWhere}
    `,
      txnParams,
    );

    const receiptDocIds = new Set();
    const issueDocIds = new Set();
    const issuedItemsMap = new Map<string, number>();
    const trendMap = new Map<string, any>();

    const isMonthView =
      !start ||
      !end ||
      end.getTime() - start.getTime() > 30 * 24 * 60 * 60 * 1000;

    for (const txn of txns) {
      const dt = new Date(txn.transaction_date);
      const trendKey = isMonthView
        ? `T${dt.getMonth() + 1}/${dt.getFullYear().toString().substring(2)}`
        : `${dt.getDate()}/${dt.getMonth() + 1}`;

      if (!trendMap.has(trendKey)) {
        trendMap.set(trendKey, {
          label: trendKey,
          receiptValue: 0,
          issueValue: 0,
          receiptQty: 0,
          issueQty: 0,
          _date: dt,
        });
      }
      const t = trendMap.get(trendKey);
      const cost = parseFloat(txn.unit_cost || 0);

      if (txn.transaction_type === 'RECEIPT') {
        if (txn.document_id) receiptDocIds.add(txn.document_id);
        t.receiptQty += parseFloat(txn.qty_in || '0');
        t.receiptValue += parseFloat(txn.qty_in || '0') * cost;
      } else if (txn.transaction_type === 'ISSUE') {
        if (txn.document_id) issueDocIds.add(txn.document_id);
        t.issueQty += parseFloat(txn.qty_out || '0');
        t.issueValue += parseFloat(txn.qty_out || '0') * cost;

        const currentQty = issuedItemsMap.get(txn.item_id) || 0;
        issuedItemsMap.set(
          txn.item_id,
          currentQty + parseFloat(txn.qty_out || '0'),
        );
      }
    }

    const stockTrend = Array.from(trendMap.values())
      .sort((a, b) => a._date.getTime() - b._date.getTime())
      .map((t) => {
        delete t._date;
        return t;
      });

    const topIssuedItems = Array.from(issuedItemsMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([itemId, totalIssued]) => {
        const item = items.find((i: any) => i.item_id === itemId);
        return {
          itemId,
          sku: item?.sku || '',
          itemName: item?.item_name || '',
          itemTypeName: item?.type_name || '',
          totalIssued,
          currentStock: item ? parseFloat(item.qty) : 0,
        };
      });

    // Calculate vehicleBomStats and vehicleTrend
    let vehicleWhere = `WHERE 1=1`;
    const vehicleParams: any[] = [];
    if (start) {
      vehicleParams.push(start);
      vehicleWhere += ` AND (s.created_at >= $${vehicleParams.length} OR s.updated_at >= $${vehicleParams.length})`;
    }
    if (end) {
      vehicleParams.push(end);
      vehicleWhere += ` AND (s.created_at <= $${vehicleParams.length} OR s.updated_at <= $${vehicleParams.length})`;
    }

    // We get all serials that are linked to a BOM via MO.
    const vehicleQuery = `
      SELECT 
        b.bom_name,
        s.status,
        s.created_at,
        s.updated_at
      FROM erp_inventory_tracking_serials s
      JOIN erp_production_orders po ON s.production_order_id = po.id
      JOIN erp_boms b ON (po.output_metadata->>'bomId')::uuid = b.id
      ${vehicleWhere}
    `;

    const serialsRaw = await this.dataSource.query(vehicleQuery, vehicleParams);

    const vehicleBomStatsMap = new Map<
      string,
      {
        bomName: string;
        currentStock: number;
        issuedInPeriod: number;
        receivedInPeriod: number;
      }
    >();
    const vehicleTrendMap = new Map<
      string,
      {
        periodLabel: string;
        _date: Date;
        receiptsByBom: Record<string, number>;
        issuesByBom: Record<string, number>;
      }
    >();

    for (const s of serialsRaw) {
      const bomName = s.bom_name;
      if (!vehicleBomStatsMap.has(bomName)) {
        vehicleBomStatsMap.set(bomName, {
          bomName,
          currentStock: 0,
          issuedInPeriod: 0,
          receivedInPeriod: 0,
        });
      }
      const stat = vehicleBomStatsMap.get(bomName)!;

      if (s.status === 'IN_STOCK') {
        stat.currentStock++;
      }

      const createdDt = new Date(s.created_at);
      const updatedDt = new Date(s.updated_at);

      const createdInPeriod =
        (!start || createdDt >= start) && (!end || createdDt <= end);
      const updatedInPeriod =
        (!start || updatedDt >= start) && (!end || updatedDt <= end);

      if (createdInPeriod) {
        stat.receivedInPeriod++;

        // Add to Trend
        const trendKey = isMonthView
          ? `T${createdDt.getMonth() + 1}/${createdDt.getFullYear().toString().substring(2)}`
          : `${createdDt.getDate()}/${createdDt.getMonth() + 1}`;
        if (!vehicleTrendMap.has(trendKey)) {
          vehicleTrendMap.set(trendKey, {
            periodLabel: trendKey,
            _date: createdDt,
            receiptsByBom: {},
            issuesByBom: {},
          });
        }
        const t = vehicleTrendMap.get(trendKey)!;
        t.receiptsByBom[bomName] = (t.receiptsByBom[bomName] || 0) + 1;
      }

      if (s.status === 'SOLD' && updatedInPeriod) {
        stat.issuedInPeriod++;

        // Add to Trend
        const trendKey = isMonthView
          ? `T${updatedDt.getMonth() + 1}/${updatedDt.getFullYear().toString().substring(2)}`
          : `${updatedDt.getDate()}/${updatedDt.getMonth() + 1}`;
        if (!vehicleTrendMap.has(trendKey)) {
          vehicleTrendMap.set(trendKey, {
            periodLabel: trendKey,
            _date: updatedDt,
            receiptsByBom: {},
            issuesByBom: {},
          });
        }
        const t = vehicleTrendMap.get(trendKey)!;
        t.issuesByBom[bomName] = (t.issuesByBom[bomName] || 0) + 1;
      }
    }

    const vehicleBomStats = Array.from(vehicleBomStatsMap.values());
    const vehicleTrend = Array.from(vehicleTrendMap.values())
      .sort((a, b) => a._date.getTime() - b._date.getTime())
      .map((t) => {
        const { _date, ...rest } = t;
        return rest;
      });

    return {
      message: 'Lấy dữ liệu tổng quan kho thành công',
      data: {
        totalSkus: items.length,
        totalStockValue,
        totalReceiptsCount: receiptDocIds.size,
        totalIssuesCount: issueDocIds.size,
        lowStockCount,
        zeroStockCount,
        stockTrend,
        typeBreakdown,
        topStockItems,
        topIssuedItems,
        alertItems,
        vehicleBomStats,
        vehicleTrend,
      },
    };
  }
}
