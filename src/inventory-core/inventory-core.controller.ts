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
import { PaginationDto } from '../common/dto/pagination.dto';
import { InventoryItemsService } from './inventory-core.service';
import { CreateInventoryItemDto } from './dto/create-item.dto';
import { UpdateInventoryItemDto } from './dto/update-item.dto';
import { InventoryMasterQueryDto } from './dto/inventory-master-query.dto';
import { CreateUomDto } from './dto/create-uom.dto';
import { UpdateUomDto } from './dto/update-uom.dto';
import { CreateItemTypeDto } from './dto/create-item-type.dto';
import { UpdateItemTypeDto } from './dto/update-item-type.dto';

@ApiTags('erp_inventory_items')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('inventory')
export class InventoryItemsController {
  constructor(private readonly service: InventoryItemsService) {}

  @RequirePermissions({ resource: 'inventory_items', action: 'create' })
  @Post('items')
  create(@Body() dto: CreateInventoryItemDto) {
    return this.service.create(dto);
  }

  @RequirePermissions({ resource: 'inventory_items', action: 'read' })
  @Get('items')
  findAll(@Query() query: PaginationDto) {
    return this.service.findAll(query);
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

  @RequirePermissions({ resource: 'inventory_items', action: 'create' })
  @Post('item-types')
  createItemType(@Body() dto: CreateItemTypeDto) {
    return this.service.createItemType(dto);
  }

  @RequirePermissions({ resource: 'inventory_items', action: 'update' })
  @Patch('item-types/:id')
  updateItemType(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateItemTypeDto,
  ) {
    return this.service.updateItemType(id, dto);
  }

  @RequirePermissions({ resource: 'inventory_items', action: 'delete' })
  @Delete('item-types/:id')
  removeItemType(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.softDeleteItemType(id);
  }

  @RequirePermissions({ resource: 'inventory_items', action: 'read' })
  @Get('items/:id/movements')
  getMovements(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.getMovements(id);
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
}
