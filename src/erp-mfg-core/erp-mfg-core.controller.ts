import {
  Body,
  Controller,
  Get,
  Param,
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
import { ErpMfgCoreService } from './erp-mfg-core.service';

@ApiTags('erp_manufacturing_core')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('erp-manufacturing')
export class ErpMfgCoreController {
  constructor(private readonly service: ErpMfgCoreService) {}

  @RequirePermissions({ resource: 'inventory_items', action: 'read' })
  @Get('items/components')
  listComponents(@Query() query: PaginationDto) {
    return this.service.listComponents(query);
  }

  @RequirePermissions({ resource: 'inventory_items', action: 'create' })
  @Post('items/components')
  createComponent(@Body() body: any) {
    return this.service.createComponent(body);
  }

  @RequirePermissions({ resource: 'inventory_items', action: 'read' })
  @Get('items/components/:id')
  getComponent(@Param('id') id: string) {
    return this.service.getComponent(id);
  }

  @RequirePermissions({ resource: 'inventory_items', action: 'update' })
  @Patch('items/components/:id')
  updateComponent(@Param('id') id: string, @Body() body: any) {
    return this.service.updateComponent(id, body);
  }

  // --- As-Built BOM for Vehicle ---
  @RequirePermissions({ resource: 'inventory_items', action: 'read' })
  @Get('items/vehicles/:id/as-built-bom')
  getAsBuiltBom(@Param('id') id: string) {
    return this.service.getAsBuiltBom(id);
  }

  @RequirePermissions({ resource: 'inventory_items', action: 'read' })
  @Get('items/components/:id/stock-summary')
  getComponentStockSummary(@Param('id') id: string) {
    return this.service.getComponentStockSummary(id);
  }

  @RequirePermissions({ resource: 'inventory_items', action: 'read' })
  @Get('items/components/:id/txns')
  listComponentTxns(@Param('id') id: string, @Query() query: PaginationDto) {
    return this.service.listComponentTxns(id, query);
  }

  @RequirePermissions({ resource: 'purchase_orders', action: 'read' })
  @Get('purchase-orders')
  listPurchaseOrders(@Query() query: PaginationDto) {
    return this.service.listPurchaseOrders(query);
  }

  @RequirePermissions({ resource: 'purchase_orders', action: 'read' })
  @Get('purchase-orders/:id')
  getPurchaseOrder(@Param('id') id: string) {
    return this.service.getPurchaseOrder(id);
  }

  @RequirePermissions({ resource: 'vehicles', action: 'read' })
  @Get('vehicles')
  listVehicles(@Query() query: PaginationDto) {
    return this.service.listVehicles(query);
  }

  @RequirePermissions({ resource: 'vehicles', action: 'read' })
  @Get('vehicles/:id')
  getVehicle(@Param('id') id: string) {
    return this.service.getVehicle(id);
  }

  @RequirePermissions({ resource: 'vehicles', action: 'create' })
  @Post('vehicles')
  createVehicle(@Body() body: any) {
    return this.service.createVehicle(body);
  }

  @RequirePermissions({ resource: 'vehicles', action: 'read' })
  @Get('items/serials/:serialId/assigned-vehicle')
  getVehicleBySerial(@Param('serialId') serialId: string) {
    return this.service.getVehicleBySerial(serialId);
  }
}
