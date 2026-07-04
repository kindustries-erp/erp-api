import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository, ArrayContains } from 'typeorm';
import { ErpBusinessPartner } from '../business-partners-core/entities/erp_business_partner.entity';
import { ErpInventoryItem } from '../inventory-core/entities/erp_inventory_item.entity';
import { ErpUom } from '../inventory-core/entities/erp_uom.entity';
import { ErpItemType } from '../inventory-core/entities/erp_item_type.entity';
import { ErpEmployee } from '../employees-core/entities/erp_employee.entity';
import { ErpInvoice } from '../erp-invoices-core/entities/erp_invoice.entity';

export interface BasicMastersQueryDto {
  search?: string;
  limit?: number;
  page?: number;
  entities?: string;
  inventoryItemAttributes?: string;
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
    @InjectRepository(ErpEmployee)
    private readonly employeeRepository: Repository<ErpEmployee>,
    @InjectRepository(ErpInvoice)
    private readonly invoiceRepository: Repository<ErpInvoice>,
  ) {}

  async findBasicLists(query: BasicMastersQueryDto) {
    const search = query.search?.trim();
    const limit = Math.min(Math.max(Number(query.limit ?? 50), 1), 200);
    const page = Math.max(Number(query.page ?? 1), 1);
    const skip = (page - 1) * limit;

    const requestedEntities = query.entities
      ? query.entities.split(',').map((e) => e.trim())
      : ['customers', 'suppliers', 'inventoryItems', 'uoms', 'itemTypes'];

    const includeCustomers = requestedEntities.includes('customers');
    const includeSuppliers = requestedEntities.includes('suppliers');
    const includeItems = requestedEntities.includes('inventoryItems');
    const includeUoms = requestedEntities.includes('uoms');
    const includeItemTypes = requestedEntities.includes('itemTypes');
    const includeEmployees = requestedEntities.includes('employees');
    const includeErpInvoices = requestedEntities.includes('erpInvoices');

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
      : { partnerType: 'CUSTOMER', isDeleted: false, status: 'ACTIVE' };

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
      : { partnerType: 'VENDOR', isDeleted: false, status: 'ACTIVE' };

    let itemWhere: any = search
      ? [
          {
            isDeleted: false,
            status: 'ACTIVE',
            itemName: ILike(`%${search}%`),
          },
          { isDeleted: false, status: 'ACTIVE', sku: ILike(`%${search}%`) },
        ]
      : { isDeleted: false, status: 'ACTIVE' };

    if (query.inventoryItemAttributes) {
      const attrs = query.inventoryItemAttributes
        .split(',')
        .map((a) => a.trim());
      if (Array.isArray(itemWhere)) {
        itemWhere = itemWhere.map((w) => ({
          ...w,
          attributes: ArrayContains(attrs),
        }));
      } else {
        itemWhere.attributes = ArrayContains(attrs);
      }
    }

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

    const employeeWhere = search
      ? [
          { status: 'ACTIVE', fullName: ILike(`%${search}%`) },
          { status: 'ACTIVE', employeeCode: ILike(`%${search}%`) },
        ]
      : { status: 'ACTIVE' };

    const invoiceWhere = search
      ? [
          { isDeleted: false, invoiceNo: ILike(`%${search}%`) },
          { isDeleted: false, sellerName: ILike(`%${search}%`) },
          { isDeleted: false, buyerName: ILike(`%${search}%`) },
        ]
      : { isDeleted: false };

    const [
      customers,
      suppliers,
      items,
      uoms,
      itemTypes,
      employees,
      erpInvoices,
    ] = await Promise.all([
      includeCustomers
        ? this.businessPartnerRepository.find({
            where: customerWhere,
            take: limit,
            skip,
            order: { name: 'ASC' },
            select: ['id', 'code', 'name', 'displayName', 'partnerType'],
          })
        : Promise.resolve([]),
      includeSuppliers
        ? this.businessPartnerRepository.find({
            where: supplierWhere,
            take: limit,
            skip,
            order: { name: 'ASC' },
            select: ['id', 'code', 'name', 'displayName', 'partnerType'],
          })
        : Promise.resolve([]),
      includeItems
        ? this.inventoryItemRepository.find({
            where: itemWhere,
            take: limit,
            skip,
            order: { itemName: 'ASC' },
            select: [
              'id',
              'sku',
              'itemName',
              'uomId',
              'itemTypeId',
              'status',
              'attributes',
            ],
            relations: ['uom', 'itemType'],
          })
        : Promise.resolve([]),
      includeUoms
        ? this.uomRepository.find({
            where: uomWhere,
            take: limit,
            skip,
            order: { code: 'ASC' },
            select: ['id', 'code', 'name'],
          })
        : Promise.resolve([]),
      includeItemTypes
        ? this.itemTypeRepository.find({
            where: itemTypeWhere,
            take: limit,
            skip,
            order: { code: 'ASC' },
            select: ['id', 'code', 'name'],
          })
        : Promise.resolve([]),
      includeEmployees
        ? this.employeeRepository.find({
            where: employeeWhere,
            take: limit,
            skip,
            order: { fullName: 'ASC' },
            select: ['id', 'employeeCode', 'fullName', 'status'],
          })
        : Promise.resolve([]),
      includeErpInvoices
        ? this.invoiceRepository.find({
            where: invoiceWhere,
            take: limit,
            skip,
            order: { invoiceDate: 'DESC' },
            select: [
              'id',
              'invoiceNo',
              'invoiceDate',
              'sellerName',
              'direction',
              'status',
            ],
          })
        : Promise.resolve([]),
    ]);

    return {
      items: {
        customers,
        suppliers,
        inventoryItems: items,
        uoms,
        itemTypes,
        employees,
        erpInvoices,
      },
      meta: {
        search: search ?? null,
        limit,
        page,
        entities: requestedEntities,
      },
    };
  }
}
