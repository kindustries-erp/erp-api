import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../auth/guards/core-rbac.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { InventoryStockCoreService } from './inventory-stock-core.service';
import { InventoryStockQueryDto } from './dto/inventory-stock-query.dto';

@ApiTags('inventory_stock')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('inventory/stock')
export class InventoryStockCoreController {
  constructor(private readonly service: InventoryStockCoreService) {}

  @RequirePermissions({ resource: 'inventory_items', action: 'read' })
  @Get()
  findAll(@Query() query: InventoryStockQueryDto) {
    return this.service.findAll(query);
  }
}
