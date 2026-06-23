import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, ILike, Repository, In } from 'typeorm';
import { PaginationDto } from '../common/dto/pagination.dto';
import { resolveSortOrder } from '../common/utils/sort.util';
import { ErpInventoryItem } from './entities/erp_inventory_item.entity';
import { ErpInventoryTransaction } from './entities/erp_inventory_transaction.entity';
import { ErpInventoryBalance } from './entities/erp_inventory_balance.entity';
import { CreateInventoryItemDto } from './dto/create-item.dto';
import { UpdateInventoryItemDto } from './dto/update-item.dto';
import { ErpUom } from './entities/erp_uom.entity';
import { ErpItemType } from './entities/erp_item_type.entity';
import { ErpTrackingCategory } from './entities/erp_tracking_category.entity';
import { CreateUomDto } from './dto/create-uom.dto';
import { UpdateUomDto } from './dto/update-uom.dto';
import { CreateItemTypeDto } from './dto/create-item-type.dto';
import { UpdateItemTypeDto } from './dto/update-item-type.dto';
import { CreateTrackingCategoryDto } from './dto/create-tracking-category.dto';
import { UpdateTrackingCategoryDto } from './dto/update-tracking-category.dto';
import { InventoryMasterQueryDto } from './dto/inventory-master-query.dto';
import { WarehouseVoucherQueryDto } from './dto/warehouse-voucher-query.dto';
import { InventorySerialQueryDto } from './dto/inventory-serial-query.dto';
import { ErpInventorySerial } from './entities/erp_inventory_serial.entity';

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
    @InjectRepository(ErpInventorySerial)
    private readonly serialRepository: Repository<ErpInventorySerial>,
    private readonly dataSource: DataSource,
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
    const uom = await this.ensureUomActive(dto.uom);
    const itemType = await this.ensureItemTypeActive(dto.itemType);
    const trackingCategory = await this.ensureTrackingCategoryActive(
      dto.trackingCategoryKey,
    );
    const entity = this.repository.create({
      ...dto,
      uom: uom.code,
      itemType: itemType.code,
      trackingPolicy: dto.trackingPolicy ?? 'NONE',
      trackingCategoryKey: trackingCategory?.code ?? null,
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
    if (query.itemType) {
      baseWhere.itemType = query.itemType;
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

    const order = resolveSortOrder(query.sort, {
      allowedFields: ['createdAt', 'itemName', 'sku', 'status', 'itemType'],
      columnMap: {
        created_at: 'createdAt',
        item_name: 'itemName',
        item_type: 'itemType',
      },
      defaultOrder: { createdAt: 'DESC' },
    });

    const [items, total] = await this.repository.findAndCount({
      where: whereCondition,
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
    const data = await this.repository.findOneByOrFail({ id });
    return { message: 'Lấy thông tin thành công', data };
  }

  async update(id: string, dto: UpdateInventoryItemDto) {
    const patch: Partial<ErpInventoryItem> = {
      ...dto,
    } as Partial<ErpInventoryItem>;
    if (dto.uom !== undefined) {
      const uom = await this.ensureUomActive(dto.uom);
      patch.uom = uom.code;
    }
    if (dto.itemType !== undefined) {
      const itemType = await this.ensureItemTypeActive(dto.itemType);
      patch.itemType = itemType.code;
    }
    if (dto.trackingCategoryKey !== undefined) {
      const trackingCategory = await this.ensureTrackingCategoryActive(
        dto.trackingCategoryKey,
      );
      patch.trackingCategoryKey = trackingCategory?.code ?? null;
    }
    if (dto.trackingPolicy !== undefined) {
      patch.trackingPolicy = dto.trackingPolicy;
    }
    await this.repository.update(id, patch);
    const data = await this.repository.findOneByOrFail({ id });
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
      SELECT g.id, g.receipt_no as "receiptNo", g.receipt_date as "receiptDate", g.status, SUM(l.qty_received) as qty
      FROM public.erp_goods_receipts g
      JOIN public.erp_goods_receipt_lines l ON g.id = l.goods_receipt_id
      WHERE l.item_id = $1 AND g.is_deleted = false
      GROUP BY g.id, g.receipt_no, g.receipt_date, g.status
      ORDER BY g.receipt_date DESC, g.id DESC
      LIMIT 10
    `,
      [id],
    );

    // Goods Issues (limit 10)
    const gis = await this.dataSource.query(
      `
      SELECT g.id, g.issue_no as "issueNo", g.issue_date as "issueDate", g.status, SUM(l.qty_issued) as qty
      FROM public.erp_goods_issues g
      JOIN public.erp_goods_issue_lines l ON g.id = l.goods_issue_id
      WHERE l.item_id = $1 AND g.is_deleted = false
      GROUP BY g.id, g.issue_no, g.issue_date, g.status
      ORDER BY g.issue_date DESC, g.id DESC
      LIMIT 10
    `,
      [id],
    );

    // Production Orders (limit 10)
    const pos = await this.dataSource.query(
      `
      SELECT p.id, p.reference_no as "orderNo", p.planned_start_date as "orderDate", p.status, 'FG' as role, p.qty_to_produce as qty
      FROM public.erp_production_orders p
      WHERE p.finished_good_item_id = $1 AND p.is_deleted = false
      UNION
      SELECT p.id, p.reference_no as "orderNo", p.planned_start_date as "orderDate", p.status, 'COMPONENT' as role, SUM(m.qty_required) as qty
      FROM public.erp_production_orders p
      JOIN public.erp_production_order_materials m ON p.id = m.production_order_id
      WHERE m.item_id = $1 AND p.is_deleted = false
      GROUP BY p.id, p.reference_no, p.planned_start_date, p.status
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
      params.push(query.dateTo);
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
               po.po_no as "poNo"
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
               NULL as "poNo"
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
      .leftJoinAndSelect('erp_inventory_items', 'i', 's.item_id = i.id')
      .leftJoinAndSelect('erp_vehicles', 'v', 's.vin_id = v.id');

    if (query.itemId) {
      qb.andWhere('s.item_id = :itemId', { itemId: query.itemId });
    }

    if (query.itemType) {
      qb.andWhere('i.item_type = :itemType', { itemType: query.itemType });
    } else {
      // If no itemType is provided, we can either default to FG or return all.
      // Based on user request, track ANY item that allows tracking, so no default filter needed here.
    }

    if (query.trackingPolicy) {
      qb.andWhere('i.tracking_policy = :trackingPolicy', {
        trackingPolicy: query.trackingPolicy,
      });
    } else {
      // By default, we only want tracked instances, i.e., trackingPolicy is not 'NONE'
      qb.andWhere('i.tracking_policy != :none', { none: 'NONE' });
    }

    if (query.search) {
      qb.andWhere(
        '(s.serial_no ILIKE :search OR i.item_name ILIKE :search OR i.sku ILIKE :search)',
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
    const [itemsRaw, total] = await Promise.all([
      qb.getRawMany(),
      qb.getCount(),
    ]);
    // Map raw results to standard format
    const items = itemsRaw.map((raw) => ({
      id: raw.s_id,
      serialNo: raw.s_serial_no,
      itemId: raw.s_item_id,
      vinId: raw.s_vin_id,
      vin: raw.v_vin,
      engineNo: raw.v_engine_no,
      lotId: raw.s_lot_id,
      createdAt: raw.s_created_at,
      updatedAt: raw.s_updated_at,
      item: {
        id: raw.i_id,
        sku: raw.i_sku,
        itemName: raw.i_item_name,
        itemType: raw.i_item_type,
        trackingPolicy: raw.i_tracking_policy,
        trackingCategoryKey: raw.i_tracking_category_key,
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
}
