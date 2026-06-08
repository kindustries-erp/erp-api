import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PaginationDto } from '../common/dto/pagination.dto';
import { SalesServiceOrdersCoreService } from './sales-service-orders-core.service';

@ApiTags('sales_service_orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sales-service-orders')
export class SalesServiceOrdersCoreController {
  constructor(private readonly service: SalesServiceOrdersCoreService) {}

  @Get()
  findAll(@Query() query: PaginationDto) {
    return this.service.findAll(query);
  }
}
