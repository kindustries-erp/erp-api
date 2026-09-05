import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../auth/guards/core-rbac.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { ErpResource, ErpAction } from '@/rbac-core/enums';
import { InventoryItemQueryDto } from './dto/inventory-item-query.dto';
import { InventoryItemsService } from './inventory-core.service';
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
import {
  ConfirmDeliveryDto,
  ConfirmDeliveriesDto,
} from './dto/confirm-delivery.dto';
import { UpdateSerialLifecycleDto } from './dto/update-serial-lifecycle.dto';
import { InventoryDashboardQueryDto } from './dto/inventory-dashboard-query.dto';
import { InventoryLotService } from './services/inventory-lot.service';
import { InventoryCustomService } from './services/inventory-custom.service';
import { InventoryLotQueryDto } from './dto/inventory-lot-query.dto';
import { InventoryCustomQueryDto } from './dto/inventory-custom-query.dto';

@ApiTags('erp_inventory_items')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('inventory')
export class InventoryItemsController {
  constructor(
    private readonly service: InventoryItemsService,
    private readonly lotService: InventoryLotService,
    private readonly customService: InventoryCustomService,
  ) {}

  @RequirePermissions({
    resource: ErpResource.INVENTORY_ITEMS,
    action: ErpAction.READ,
  })
  @Get('dashboard')
  getDashboardStats(@Query() query: InventoryDashboardQueryDto) {
    return this.service.getDashboardStats(query);
  }

  @RequirePermissions({
    resource: ErpResource.INVENTORY_ITEMS,
    action: ErpAction.CREATE,
  })
  @Post('items')
  create(@Body() dto: CreateInventoryItemDto) {
    return this.service.create(dto);
  }

  @RequirePermissions({
    resource: ErpResource.INVENTORY_ITEMS,
    action: ErpAction.READ,
  })
  @Get('items')
  findAll(@Query() query: InventoryItemQueryDto) {
    return this.service.findAll(query);
  }

  @RequirePermissions({
    resource: ErpResource.INVENTORY_ITEMS,
    action: ErpAction.READ,
  })
  @Get('items/column-options')
  async getColumnOptions(
    @Query('column') column: string,
    @Query('search') search?: string,
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '20',
    @Query('filters') filters?: string,
  ) {
    return this.service.getColumnOptions(
      column,
      search,
      parseInt(page, 10) || 1,
      parseInt(pageSize, 10) || 20,
      filters,
    );
  }

  @RequirePermissions({
    resource: ErpResource.INVENTORY_ITEMS,
    action: ErpAction.READ,
  })
  @Get('items/balances')
  getBalances(@Query('ids') ids: string) {
    return this.service.getBalances(ids);
  }

  @RequirePermissions({
    resource: ErpResource.INVENTORY_ITEMS,
    action: ErpAction.READ,
  })
  @Get('uoms')
  listUoms(@Query() query: InventoryMasterQueryDto) {
    return this.service.listUoms(query);
  }

  @RequirePermissions({
    resource: ErpResource.INVENTORY_ITEMS,
    action: ErpAction.CREATE,
  })
  @Post('uoms')
  createUom(@Body() dto: CreateUomDto) {
    return this.service.createUom(dto);
  }

  @RequirePermissions({
    resource: ErpResource.INVENTORY_ITEMS,
    action: ErpAction.UPDATE,
  })
  @Patch('uoms/:id')
  updateUom(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUomDto,
  ) {
    return this.service.updateUom(id, dto);
  }

  @RequirePermissions({
    resource: ErpResource.INVENTORY_ITEMS,
    action: ErpAction.DELETE,
  })
  @Delete('uoms/:id')
  removeUom(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.softDeleteUom(id);
  }

  @RequirePermissions({
    resource: ErpResource.INVENTORY_ITEMS,
    action: ErpAction.READ,
  })
  @Get('item-types')
  listItemTypes(@Query() query: InventoryMasterQueryDto) {
    return this.service.listItemTypes(query);
  }

  @RequirePermissions({
    resource: ErpResource.INVENTORY_ITEMS,
    action: ErpAction.READ,
  })
  @Get('tracking-policies')
  listTrackingPolicies(@Query() query: InventoryMasterQueryDto) {
    return this.service.listTrackingPolicies(query);
  }

  @RequirePermissions({
    resource: ErpResource.INVENTORY_ITEMS,
    action: ErpAction.READ,
  })
  @Get('tracking-categories')
  listTrackingCategories(@Query() query: InventoryMasterQueryDto) {
    return this.service.listTrackingCategories(query);
  }

  @RequirePermissions({
    resource: ErpResource.INVENTORY_ITEMS,
    action: ErpAction.CREATE,
  })
  @Post('item-types')
  createItemType(@Body() dto: CreateItemTypeDto) {
    return this.service.createItemType(dto);
  }

  @RequirePermissions({
    resource: ErpResource.INVENTORY_ITEMS,
    action: ErpAction.CREATE,
  })
  @Post('tracking-categories')
  createTrackingCategory(@Body() dto: CreateTrackingCategoryDto) {
    return this.service.createTrackingCategory(dto);
  }

  @RequirePermissions({
    resource: ErpResource.INVENTORY_ITEMS,
    action: ErpAction.UPDATE,
  })
  @Patch('item-types/:id')
  updateItemType(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateItemTypeDto,
  ) {
    return this.service.updateItemType(id, dto);
  }

  @RequirePermissions({
    resource: ErpResource.INVENTORY_ITEMS,
    action: ErpAction.UPDATE,
  })
  @Patch('tracking-categories/:id')
  updateTrackingCategory(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateTrackingCategoryDto,
  ) {
    return this.service.updateTrackingCategory(id, dto);
  }

  @RequirePermissions({
    resource: ErpResource.INVENTORY_ITEMS,
    action: ErpAction.DELETE,
  })
  @Delete('item-types/:id')
  removeItemType(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.softDeleteItemType(id);
  }

  @RequirePermissions({
    resource: ErpResource.INVENTORY_ITEMS,
    action: ErpAction.DELETE,
  })
  @Delete('tracking-categories/:id')
  removeTrackingCategory(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.softDeleteTrackingCategory(id);
  }

  @RequirePermissions({
    resource: ErpResource.INVENTORY_ITEMS,
    action: ErpAction.READ,
  })
  @Get('items/:id/movements')
  getMovements(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.getMovements(id);
  }

  @RequirePermissions({
    resource: ErpResource.INVENTORY_ITEMS,
    action: ErpAction.READ,
  })
  @Get('items/:id/connections')
  getConnections(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.getItemConnections(id);
  }

  @RequirePermissions({
    resource: ErpResource.INVENTORY_ITEMS,
    action: ErpAction.READ,
  })
  @Get('items/:id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.findOne(id);
  }

  @RequirePermissions({
    resource: ErpResource.INVENTORY_ITEMS,
    action: ErpAction.UPDATE,
  })
  @Patch('items/:id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateInventoryItemDto,
  ) {
    return this.service.update(id, dto);
  }

  @RequirePermissions({
    resource: ErpResource.INVENTORY_ITEMS,
    action: ErpAction.DELETE,
  })
  @Delete('items/:id')
  removeItem(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.softDeleteItem(id);
  }

  @RequirePermissions({
    resource: ErpResource.INVENTORY_ITEMS,
    action: ErpAction.READ,
  })
  @Get('warehouse-vouchers')
  listWarehouseVouchers(@Query() query: WarehouseVoucherQueryDto) {
    return this.service.listWarehouseVouchers(query);
  }

  @RequirePermissions({
    resource: ErpResource.INVENTORY_ITEMS,
    action: ErpAction.READ,
  })
  @Get('warehouse-vouchers/column-options')
  getWarehouseVoucherColumnOptions(
    @Query('column') column: string,
    @Query('search') search: string,
    @Query('page') page: string,
    @Query('pageSize') pageSize: string,
    @Query('column_filters') filtersStr?: string,
    @Query('type') type?: string,
  ) {
    return this.service.getWarehouseVoucherColumnOptions(
      column,
      search,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
      filtersStr,
      type,
    );
  }

  @RequirePermissions({
    resource: ErpResource.INVENTORY_ITEMS,
    action: ErpAction.READ,
  })
  @Get('serials')
  listSerials(@Query() query: InventorySerialQueryDto) {
    return this.service.listSerials(query);
  }

  @RequirePermissions({
    resource: ErpResource.INVENTORY_ITEMS,
    action: ErpAction.READ,
  })
  @Get('lots')
  listLots(@Query() query: InventoryLotQueryDto) {
    return this.lotService.listLots(query);
  }

  @RequirePermissions({
    resource: ErpResource.INVENTORY_ITEMS,
    action: ErpAction.READ,
  })
  @Get('customs')
  listCustoms(@Query() query: InventoryCustomQueryDto) {
    return this.customService.listCustoms(query);
  }

  @RequirePermissions({
    resource: ErpResource.INVENTORY_ITEMS,
    action: ErpAction.READ,
  })
  @Get('serials/column-options')
  getSerialColumnOptions(
    @Query('column') column: string,
    @Query('search') search: string,
    @Query('page') page: string,
    @Query('pageSize') pageSize: string,
    @Query('column_filters') filtersStr?: string,
    @Query('trackingPolicy') trackingPolicy?: string,
  ) {
    return this.service.getSerialColumnOptions(
      column,
      search,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
      filtersStr,
      trackingPolicy,
    );
  }

  @RequirePermissions({
    resource: ErpResource.INVENTORY_ITEMS,
    action: ErpAction.READ,
  })
  @Get('serials/:id')
  getSerial(@Param('id') id: string) {
    return this.service.getSerial(id);
  }

  @RequirePermissions({
    resource: ErpResource.INVENTORY_ITEMS,
    action: ErpAction.UPDATE,
  })
  @Patch('serials/:id')
  updateSerial(@Param('id') id: string, @Body() dto: UpdateInventorySerialDto) {
    return this.service.updateSerial(id, dto);
  }

  @RequirePermissions({
    resource: ErpResource.SALES_ORDERS,
    action: ErpAction.UPDATE,
  })
  @Post('serials/confirm-delivery-bulk')
  confirmDeliveries(@Body() dto: ConfirmDeliveriesDto) {
    return this.service.confirmDeliveries(dto);
  }

  @RequirePermissions({
    resource: ErpResource.SALES_ORDERS,
    action: ErpAction.READ,
  })
  @Get('serial-lifecycles/column-options')
  getSerialLifecycleColumnOptions(
    @Query('column') column: string,
    @Query('search') search: string,
    @Query('page') page: string,
    @Query('pageSize') pageSize: string,
    @Query('column_filters') filtersStr?: string,
  ) {
    return this.service.getSerialLifecycleColumnOptions(
      column,
      search,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
      filtersStr,
    );
  }

  @RequirePermissions({
    resource: ErpResource.SALES_ORDERS,
    action: ErpAction.READ,
  })
  @Get('serial-lifecycles')
  listSerialLifecycles(@Query() query: any) {
    return this.service.listSerialLifecycles(query);
  }

  @RequirePermissions({
    resource: ErpResource.SALES_ORDERS,
    action: ErpAction.UPDATE,
  })
  @Patch('serial-lifecycles/:id')
  updateSerialLifecycle(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateSerialLifecycleDto,
  ) {
    return this.service.updateSerialLifecycle(id, dto);
  }
}
