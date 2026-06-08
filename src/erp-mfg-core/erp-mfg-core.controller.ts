import { Controller, Get, Query, UseGuards } from '@nestjs/common';
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

  @Get('purchase-orders')
  listPurchaseOrders(@Query() query: PaginationDto) {
    return this.service.listPurchaseOrders(query);
  }

  @Get('vehicles')
  listVehicles(@Query() query: PaginationDto) {
    return this.service.listVehicles(query);
  }
}
