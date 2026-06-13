import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { ErpBusinessPartner } from '../business-partners-core/entities/erp_business_partner.entity';
import { ErpInventoryItem } from '../inventory-core/entities/erp_inventory_item.entity';
import { ErpUom } from '../inventory-core/entities/erp_uom.entity';
import { ErpItemType } from '../inventory-core/entities/erp_item_type.entity';

export interface BasicMastersQueryDto {
  search?: string;
  limit?: number;
}

@Injectable()
export class BasicMastersCoreService {
  constructor(
    @InjectRepository(ErpBusinessPartner)
    private readonly businessPartnerRepository: Repository<ErpBusinessPartner>,
    @InjectRepository(ErpInventoryItem)
    private readonly inventoryItemRepository: Repository<ErpInventoryItem>,
    @InjectRepository(ErpUom)
    private readonly uomRepository: Repository<ErpUom>,
    @InjectRepository(ErpItemType)
    private readonly itemTypeRepository: Repository<ErpItemType>,
  ) {}

  async findBasicLists(query: BasicMastersQueryDto) {
    const search = query.search?.trim();
    const limit = Math.min(Math.max(Number(query.limit ?? 50), 1), 200);

    const customerWhere = search
      ? [
          {
            partnerType: 'CUSTOMER',
            isDeleted: false,
            status: 'ACTIVE',
            name: ILike(`%${search}%`),
          },
          {
            partnerType: 'CUSTOMER',
            isDeleted: false,
            status: 'ACTIVE',
            displayName: ILike(`%${search}%`),
          },
          {
            partnerType: 'CUSTOMER',
            isDeleted: false,
            status: 'ACTIVE',
            code: ILike(`%${search}%`),
          },
        ]
      : {
          partnerType: 'CUSTOMER',
          isDeleted: false,
          status: 'ACTIVE',
        };

    const supplierWhere = search
      ? [
          {
            partnerType: 'VENDOR',
            isDeleted: false,
            status: 'ACTIVE',
            name: ILike(`%${search}%`),
          },
          {
            partnerType: 'VENDOR',
            isDeleted: false,
            status: 'ACTIVE',
            displayName: ILike(`%${search}%`),
          },
          {
            partnerType: 'VENDOR',
            isDeleted: false,
            status: 'ACTIVE',
            code: ILike(`%${search}%`),
          },
        ]
      : {
          partnerType: 'VENDOR',
          isDeleted: false,
          status: 'ACTIVE',
        };

    const itemWhere = search
      ? [
          {
            isDeleted: false,
            status: 'ACTIVE',
            itemName: ILike(`%${search}%`),
          },
          { isDeleted: false, status: 'ACTIVE', sku: ILike(`%${search}%`) },
        ]
      : { isDeleted: false, status: 'ACTIVE' };

    const uomWhere = search
      ? [
          { isDeleted: false, isActive: true, code: ILike(`%${search}%`) },
          { isDeleted: false, isActive: true, name: ILike(`%${search}%`) },
        ]
      : { isDeleted: false, isActive: true };

    const itemTypeWhere = search
      ? [
          { isDeleted: false, isActive: true, code: ILike(`%${search}%`) },
          { isDeleted: false, isActive: true, name: ILike(`%${search}%`) },
        ]
      : { isDeleted: false, isActive: true };

    const [customers, suppliers, items, uoms, itemTypes] = await Promise.all([
      this.businessPartnerRepository.find({
        where: customerWhere,
        take: limit,
        order: { name: 'ASC' },
        select: ['id', 'code', 'name', 'displayName', 'partnerType'],
      }),
      this.businessPartnerRepository.find({
        where: supplierWhere,
        take: limit,
        order: { name: 'ASC' },
        select: ['id', 'code', 'name', 'displayName', 'partnerType'],
      }),
      this.inventoryItemRepository.find({
        where: itemWhere,
        take: limit,
        order: { itemName: 'ASC' },
        select: ['id', 'sku', 'itemName', 'uom', 'itemType', 'status'],
      }),
      this.uomRepository.find({
        where: uomWhere,
        take: limit,
        order: { code: 'ASC' },
        select: ['id', 'code', 'name'],
      }),
      this.itemTypeRepository.find({
        where: itemTypeWhere,
        take: limit,
        order: { code: 'ASC' },
        select: ['id', 'code', 'name'],
      }),
    ]);

    return {
      items: {
        customers,
        suppliers,
        inventoryItems: items,
        uoms,
        itemTypes,
      },
      meta: {
        search: search ?? null,
        limit,
      },
    };
  }
}
