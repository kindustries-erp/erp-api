import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { ErpUom } from '../entities/erp_uom.entity';
import { ErpItemType } from '../entities/erp_item_type.entity';
import { ErpTrackingPolicy } from '../entities/erp_tracking_policy.entity';
import { CreateUomDto } from '../dto/create-uom.dto';
import { UpdateUomDto } from '../dto/update-uom.dto';
import { CreateItemTypeDto } from '../dto/create-item-type.dto';
import { UpdateItemTypeDto } from '../dto/update-item-type.dto';
import { InventoryMasterQueryDto } from '../dto/inventory-master-query.dto';

@Injectable()
export class InventoryMastersService {
  constructor(
    @InjectRepository(ErpUom)
    private readonly uomRepository: Repository<ErpUom>,
    @InjectRepository(ErpItemType)
    private readonly itemTypeRepository: Repository<ErpItemType>,
    @InjectRepository(ErpTrackingPolicy)
    private readonly trackingPolicyRepository: Repository<ErpTrackingPolicy>,
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

  async softDeleteUom(id: string) {
    const existing = await this.uomRepository.findOneBy({ id });
    if (!existing) throw new NotFoundException(`UOM ${id} not found`);
    existing.isDeleted = true;
    await this.uomRepository.save(existing);
    return { message: 'Đã xóa đơn vị tính thành công', data: { id } };
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

  async softDeleteItemType(id: string) {
    const existing = await this.itemTypeRepository.findOneBy({ id });
    if (!existing) throw new NotFoundException(`Item type ${id} not found`);
    existing.isDeleted = true;
    await this.itemTypeRepository.save(existing);
    return { message: 'Đã xóa loại item thành công', data: { id } };
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
}
