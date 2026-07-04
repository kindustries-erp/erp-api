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
import { SalesOrdersCoreService } from './sales-orders-core.service';
import { CreateSalesOrderDto } from './dto/create-sales-order.dto';
import { UpdateSalesOrderDto } from './dto/update-sales-order.dto';
import { ReserveSalesOrderDto } from './dto/reserve-sales-order.dto';
import { UnreserveSalesOrderDto } from './dto/unreserve-sales-order.dto';

@ApiTags('erp_sales_orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('sales-orders')
export class SalesOrdersCoreController {
  constructor(private readonly service: SalesOrdersCoreService) {}

  @RequirePermissions({ resource: 'sales_orders', action: 'create' })
  @Post()
  create(@Body() dto: CreateSalesOrderDto) {
    return this.service.create(dto);
  }

  @RequirePermissions({ resource: 'sales_orders', action: 'read' })
  @Get()
  findAll(@Query() query: PaginationDto) {
    return this.service.findAll(query);
  }

  @RequirePermissions({ resource: 'sales_orders', action: 'read' })
  @Get('next-no')
  getNextNo(@Query('date') date?: string) {
    return this.service.getNextSoNo(date);
  }

  @RequirePermissions({ resource: 'sales_orders', action: 'read' })
  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.findOne(id);
  }

  @RequirePermissions({ resource: 'sales_orders', action: 'update' })
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateSalesOrderDto,
  ) {
    return this.service.update(id, dto);
  }

  @RequirePermissions({ resource: 'sales_orders', action: 'update' })
  @Post(':id/reserve')
  reserve(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReserveSalesOrderDto,
  ) {
    return this.service.reserve(id, dto);
  }

  @RequirePermissions({ resource: 'sales_orders', action: 'update' })
  @Post(':id/unreserve')
  unreserve(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UnreserveSalesOrderDto,
  ) {
    return this.service.unreserve(id, dto);
  }

  @RequirePermissions({ resource: 'sales_orders', action: 'delete' })
  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.remove(id);
  }

  @RequirePermissions({ resource: 'sales_orders', action: 'update' })
  @Post(':id/cancel')
  cancel(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.cancel(id);
  }
}
