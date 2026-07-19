import { Injectable } from '@nestjs/common';
import { CreateInventoryItemDto } from './dto/create-item.dto';
import { UpdateInventoryItemDto } from './dto/update-item.dto';
import { InventoryMasterQueryDto } from './dto/inventory-master-query.dto';
import { WarehouseVoucherQueryDto } from './dto/warehouse-voucher-query.dto';
import { CreateUomDto } from './dto/create-uom.dto';
import { UpdateUomDto } from './dto/update-uom.dto';
import { CreateItemTypeDto } from './dto/create-item-type.dto';
import { UpdateItemTypeDto } from './dto/update-item-type.dto';
import { CreateTrackingCategoryDto } from './dto/create-tracking-category.dto';
import { UpdateTrackingCategoryDto } from './dto/update-tracking-category.dto';
import { InventorySerialQueryDto } from './dto/inventory-serial-query.dto';
import { UpdateInventorySerialDto } from './dto/update-inventory-serial.dto';
import { ConfirmDeliveryDto } from './dto/confirm-delivery.dto';
import { UpdateSerialLifecycleDto } from './dto/update-serial-lifecycle.dto';
import { InventoryDashboardQueryDto } from './dto/inventory-dashboard-query.dto';
import { InventoryItemsQueryService } from './services/inventory-items-query.service';
import { InventoryItemsLifecycleService } from './services/inventory-items-lifecycle.service';
import { InventoryMastersService } from './services/inventory-masters.service';
import { InventoryWarehouseVoucherService } from './services/inventory-warehouse-voucher.service';
import { InventorySerialService } from './services/inventory-serial.service';
import { InventoryDashboardService } from './services/inventory-dashboard.service';

@Injectable()
export class InventoryItemsService {
  constructor(
    private readonly inventoryItemsQueryService: InventoryItemsQueryService,
    private readonly inventoryItemsLifecycleService: InventoryItemsLifecycleService,
    private readonly inventoryMastersService: InventoryMastersService,
    private readonly inventoryWarehouseVoucherService: InventoryWarehouseVoucherService,
    private readonly inventorySerialService: InventorySerialService,
    private readonly inventoryDashboardService: InventoryDashboardService,
  ) {}

  getDashboardStats(query: InventoryDashboardQueryDto) {
    return this.inventoryDashboardService.getDashboardStats(query);
  }

  create(dto: CreateInventoryItemDto) {
    return this.inventoryItemsLifecycleService.create(dto);
  }

  findAll(query: any) {
    return this.inventoryItemsQueryService.findAll(query);
  }

  getBalances(idsString?: string) {
    return this.inventoryItemsQueryService.getBalances(idsString);
  }

  listUoms(query: InventoryMasterQueryDto) {
    return this.inventoryMastersService.listUoms(query);
  }

  createUom(dto: CreateUomDto) {
    return this.inventoryMastersService.createUom(dto);
  }

  updateUom(id: string, dto: UpdateUomDto) {
    return this.inventoryMastersService.updateUom(id, dto);
  }

  softDeleteUom(id: string) {
    return this.inventoryMastersService.softDeleteUom(id);
  }

  listItemTypes(query: InventoryMasterQueryDto) {
    return this.inventoryMastersService.listItemTypes(query);
  }

  listTrackingPolicies(query: InventoryMasterQueryDto) {
    return this.inventoryMastersService.listTrackingPolicies(query);
  }

  listTrackingCategories(query: InventoryMasterQueryDto) {
    return this.inventoryMastersService.listTrackingCategories(query);
  }

  createItemType(dto: CreateItemTypeDto) {
    return this.inventoryMastersService.createItemType(dto);
  }

  createTrackingCategory(dto: CreateTrackingCategoryDto) {
    return this.inventoryMastersService.createTrackingCategory(dto);
  }

  updateItemType(id: string, dto: UpdateItemTypeDto) {
    return this.inventoryMastersService.updateItemType(id, dto);
  }

  updateTrackingCategory(id: string, dto: UpdateTrackingCategoryDto) {
    return this.inventoryMastersService.updateTrackingCategory(id, dto);
  }

  softDeleteItemType(id: string) {
    return this.inventoryMastersService.softDeleteItemType(id);
  }

  softDeleteTrackingCategory(id: string) {
    return this.inventoryMastersService.softDeleteTrackingCategory(id);
  }

  getMovements(id: string) {
    return this.inventoryItemsLifecycleService.getMovements(id);
  }

  getItemConnections(id: string) {
    return this.inventoryItemsLifecycleService.getItemConnections(id);
  }

  findOne(id: string) {
    return this.inventoryItemsLifecycleService.findOne(id);
  }

  update(id: string, dto: UpdateInventoryItemDto) {
    return this.inventoryItemsLifecycleService.update(id, dto);
  }

  softDeleteItem(id: string) {
    return this.inventoryItemsLifecycleService.softDeleteItem(id);
  }

  listWarehouseVouchers(query: WarehouseVoucherQueryDto) {
    return this.inventoryWarehouseVoucherService.listWarehouseVouchers(query);
  }

  listSerials(query: InventorySerialQueryDto) {
    return this.inventorySerialService.listSerials(query);
  }

  getSerial(id: string) {
    return this.inventorySerialService.getSerial(id);
  }

  updateSerial(id: string, dto: UpdateInventorySerialDto) {
    return this.inventorySerialService.updateSerial(id, dto);
  }

  confirmDelivery(serialId: string, dto: ConfirmDeliveryDto) {
    return this.inventorySerialService.confirmDelivery(serialId, dto);
  }

  getSerialLifecycleColumnOptions(
    column: string,
    search: string,
    page: number = 1,
    pageSize: number = 20,
    filtersStr?: string,
  ) {
    return this.inventorySerialService.getSerialLifecycleColumnOptions(
      column,
      search,
      page,
      pageSize,
      filtersStr,
    );
  }

  listSerialLifecycles(query: any) {
    return this.inventorySerialService.listSerialLifecycles(query);
  }

  updateSerialLifecycle(serialId: string, dto: UpdateSerialLifecycleDto) {
    return this.inventorySerialService.updateSerialLifecycle(serialId, dto);
  }
}
