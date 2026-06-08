import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PaginationDto } from '../common/dto/pagination.dto';
import { InventoryStockCoreService } from './inventory-stock-core.service';

@ApiTags('inventory_stock')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inventory/stock')
export class InventoryStockCoreController {
  constructor(private readonly service: InventoryStockCoreService) {}

  @Get()
  findAll(@Query() query: PaginationDto) {
    return this.service.findAll(query);
  }
}
