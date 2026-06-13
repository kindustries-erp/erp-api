import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository, In } from 'typeorm';
import { PaginationDto } from '../common/dto/pagination.dto';
import { resolveSortOrder } from '../common/utils/sort.util';
import { ErpInventoryItem } from './entities/erp_inventory_item.entity';
import { ErpInventoryTransaction } from './entities/erp_inventory_transaction.entity';
import { ErpInventoryBalance } from './entities/erp_inventory_balance.entity';
import { CreateInventoryItemDto } from './dto/create-item.dto';
import { UpdateInventoryItemDto } from './dto/update-item.dto';
import { ErpUom } from './entities/erp_uom.entity';
import { ErpItemType } from './entities/erp_item_type.entity';
import { CreateUomDto } from './dto/create-uom.dto';
import { UpdateUomDto } from './dto/update-uom.dto';
import { CreateItemTypeDto } from './dto/create-item-type.dto';
import { UpdateItemTypeDto } from './dto/update-item-type.dto';
import { InventoryMasterQueryDto } from './dto/inventory-master-query.dto';

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
    const entity = this.repository.create({
      ...dto,
      uom: uom.code,
      itemType: itemType.code,
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
}
