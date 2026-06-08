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
import { PaginationDto } from '../common/dto/pagination.dto';
import { ErpMfgCoreService } from './erp-mfg-core.service';

@ApiTags('erp_manufacturing_core')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('erp-manufacturing')
export class ErpMfgCoreController {
  constructor(private readonly service: ErpMfgCoreService) {}

  @Get('items/components')
  listComponents(@Query() query: PaginationDto) {
    return this.service.listComponents(query);
  }

  @Post('items/components')
  createComponent(@Body() body: any) {
    return this.service.createComponent(body);
  }

  @Get('items/components/:id')
  getComponent(@Param('id') id: string) {
    return this.service.getComponent(id);
  }

  @Patch('items/components/:id')
  updateComponent(@Param('id') id: string, @Body() body: any) {
    return this.service.updateComponent(id, body);
  }

  @Get('items/components/:id/stock-summary')
  getComponentStockSummary(@Param('id') id: string) {
    return this.service.getComponentStockSummary(id);
  }

  @Get('items/components/:id/txns')
  listComponentTxns(@Param('id') id: string, @Query() query: PaginationDto) {
    return this.service.listComponentTxns(id, query);
  }

  @Get('purchase-orders')
  listPurchaseOrders(@Query() query: PaginationDto) {
    return this.service.listPurchaseOrders(query);
  }

  @Get('purchase-orders/:id')
  getPurchaseOrder(@Param('id') id: string) {
    return this.service.getPurchaseOrder(id);
  }

  @Get('vehicles')
  listVehicles(@Query() query: PaginationDto) {
    return this.service.listVehicles(query);
  }

  @Get('vehicles/:id')
  getVehicle(@Param('id') id: string) {
    return this.service.getVehicle(id);
  }
}
