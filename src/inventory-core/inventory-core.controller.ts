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

@ApiTags('erp_inventory_items')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('inventory')
export class InventoryItemsController {
  constructor(private readonly service: InventoryItemsService) {}

  @RequirePermissions({ resource: 'inventory_items', action: 'read' })
  @Get('dashboard')
  getDashboardStats(@Query() query: InventoryDashboardQueryDto) {
    return this.service.getDashboardStats(query);
  }

  @RequirePermissions({ resource: 'inventory_items', action: 'create' })
  @Post('items')
  create(@Body() dto: CreateInventoryItemDto) {
    return this.service.create(dto);
  }

  @RequirePermissions({ resource: 'inventory_items', action: 'read' })
  @Get('items')
  findAll(@Query() query: InventoryItemQueryDto) {
    return this.service.findAll(query);
  }

  @RequirePermissions({ resource: 'inventory_items', action: 'read' })
  @Get('items/balances')
  getBalances(@Query('ids') ids: string) {
    return this.service.getBalances(ids);
  }

  @RequirePermissions({ resource: 'inventory_items', action: 'read' })
  @Get('uoms')
  listUoms(@Query() query: InventoryMasterQueryDto) {
    return this.service.listUoms(query);
  }

  @RequirePermissions({ resource: 'inventory_items', action: 'create' })
  @Post('uoms')
  createUom(@Body() dto: CreateUomDto) {
    return this.service.createUom(dto);
  }

  @RequirePermissions({ resource: 'inventory_items', action: 'update' })
  @Patch('uoms/:id')
  updateUom(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUomDto,
  ) {
    return this.service.updateUom(id, dto);
  }

  @RequirePermissions({ resource: 'inventory_items', action: 'delete' })
  @Delete('uoms/:id')
  removeUom(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.softDeleteUom(id);
  }

  @RequirePermissions({ resource: 'inventory_items', action: 'read' })
  @Get('item-types')
  listItemTypes(@Query() query: InventoryMasterQueryDto) {
    return this.service.listItemTypes(query);
  }

  @RequirePermissions({ resource: 'inventory_items', action: 'read' })
  @Get('tracking-policies')
  listTrackingPolicies(@Query() query: InventoryMasterQueryDto) {
    return this.service.listTrackingPolicies(query);
  }

  @RequirePermissions({ resource: 'inventory_items', action: 'read' })
  @Get('tracking-categories')
  listTrackingCategories(@Query() query: InventoryMasterQueryDto) {
    return this.service.listTrackingCategories(query);
  }

  @RequirePermissions({ resource: 'inventory_items', action: 'create' })
  @Post('item-types')
  createItemType(@Body() dto: CreateItemTypeDto) {
    return this.service.createItemType(dto);
  }

  @RequirePermissions({ resource: 'inventory_items', action: 'create' })
  @Post('tracking-categories')
  createTrackingCategory(@Body() dto: CreateTrackingCategoryDto) {
    return this.service.createTrackingCategory(dto);
  }

  @RequirePermissions({ resource: 'inventory_items', action: 'update' })
  @Patch('item-types/:id')
  updateItemType(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateItemTypeDto,
  ) {
    return this.service.updateItemType(id, dto);
  }

  @RequirePermissions({ resource: 'inventory_items', action: 'update' })
  @Patch('tracking-categories/:id')
  updateTrackingCategory(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateTrackingCategoryDto,
  ) {
    return this.service.updateTrackingCategory(id, dto);
  }

  @RequirePermissions({ resource: 'inventory_items', action: 'delete' })
  @Delete('item-types/:id')
  removeItemType(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.softDeleteItemType(id);
  }

  @RequirePermissions({ resource: 'inventory_items', action: 'delete' })
  @Delete('tracking-categories/:id')
  removeTrackingCategory(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.softDeleteTrackingCategory(id);
  }

  @RequirePermissions({ resource: 'inventory_items', action: 'read' })
  @Get('items/:id/movements')
  getMovements(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.getMovements(id);
  }

  @RequirePermissions({ resource: 'inventory_items', action: 'read' })
  @Get('items/:id/connections')
  getConnections(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.getItemConnections(id);
  }

  @RequirePermissions({ resource: 'inventory_items', action: 'read' })
  @Get('items/:id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.findOne(id);
  }

  @RequirePermissions({ resource: 'inventory_items', action: 'update' })
  @Patch('items/:id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateInventoryItemDto,
  ) {
    return this.service.update(id, dto);
  }

  @RequirePermissions({ resource: 'inventory_items', action: 'delete' })
  @Delete('items/:id')
  removeItem(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.softDeleteItem(id);
  }

  @RequirePermissions({ resource: 'inventory_items', action: 'read' })
  @Get('warehouse-vouchers')
  listWarehouseVouchers(@Query() query: WarehouseVoucherQueryDto) {
    return this.service.listWarehouseVouchers(query);
  }

  @RequirePermissions({ resource: 'inventory_items', action: 'read' })
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

  @RequirePermissions({ resource: 'inventory_items', action: 'read' })
  @Get('serials')
  listSerials(@Query() query: InventorySerialQueryDto) {
    return this.service.listSerials(query);
  }

  @RequirePermissions({ resource: 'inventory_items', action: 'read' })
  @Get('serials/column-options')
  getSerialColumnOptions(
    @Query('column') column: string,
    @Query('search') search: string,
    @Query('page') page: string,
    @Query('pageSize') pageSize: string,
    @Query('column_filters') filtersStr?: string,
  ) {
    return this.service.getSerialColumnOptions(
      column,
      search,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
      filtersStr,
    );
  }

  @RequirePermissions({ resource: 'inventory_items', action: 'read' })
  @Get('serials/:id')
  getSerial(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.getSerial(id);
  }

  @RequirePermissions({ resource: 'inventory_items', action: 'update' })
  @Patch('serials/:id')
  updateSerial(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateInventorySerialDto,
  ) {
    return this.service.updateSerial(id, dto);
  }

  @RequirePermissions({ resource: 'sales_orders', action: 'update' })
  @Post('serials/confirm-delivery-bulk')
  confirmDeliveries(@Body() dto: ConfirmDeliveriesDto) {
    return this.service.confirmDeliveries(dto);
  }

  @RequirePermissions({ resource: 'sales_orders', action: 'read' })
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

  @RequirePermissions({ resource: 'sales_orders', action: 'read' })
  @Get('serial-lifecycles')
  listSerialLifecycles(@Query() query: any) {
    return this.service.listSerialLifecycles(query);
  }

  @RequirePermissions({ resource: 'sales_orders', action: 'update' })
  @Patch('serial-lifecycles/:id')
  updateSerialLifecycle(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateSerialLifecycleDto,
  ) {
    return this.service.updateSerialLifecycle(id, dto);
  }
}
