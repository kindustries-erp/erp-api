import {
  Body,
  Controller,
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
@UseGuards(JwtAuthGuard)
@Controller('inventory')
export class InventoryItemsController {
  constructor(private readonly service: InventoryItemsService) {}

  @Post('items')
  create(@Body() dto: CreateInventoryItemDto) {
    return this.service.create(dto);
  }

  @Get('items')
  findAll(@Query() query: PaginationDto) {
    return this.service.findAll(query);
  }

  @Get('uoms')
  listUoms(@Query() query: InventoryMasterQueryDto) {
    return this.service.listUoms(query);
  }

  @Post('uoms')
  createUom(@Body() dto: CreateUomDto) {
    return this.service.createUom(dto);
  }

  @Patch('uoms/:id')
  updateUom(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUomDto,
  ) {
    return this.service.updateUom(id, dto);
  }

  @Get('item-types')
  listItemTypes(@Query() query: InventoryMasterQueryDto) {
    return this.service.listItemTypes(query);
  }

  @Post('item-types')
  createItemType(@Body() dto: CreateItemTypeDto) {
    return this.service.createItemType(dto);
  }

  @Patch('item-types/:id')
  updateItemType(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateItemTypeDto,
  ) {
    return this.service.updateItemType(id, dto);
  }

  @Get('items/:id/movements')
  getMovements(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.getMovements(id);
  }

  @Get('items/:id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.findOne(id);
  }

  @Patch('items/:id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateInventoryItemDto,
  ) {
    return this.service.update(id, dto);
  }
}
