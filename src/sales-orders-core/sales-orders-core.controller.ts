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
  Res,
  StreamableFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../auth/guards/core-rbac.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { ErpResource, ErpAction } from '@/rbac-core/enums';
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

  @RequirePermissions({
    resource: ErpResource.SALES_ORDERS,
    action: ErpAction.CREATE,
  })
  @Post()
  create(@Body() dto: CreateSalesOrderDto) {
    return this.service.create(dto);
  }

  @RequirePermissions({
    resource: ErpResource.SALES_ORDERS,
    action: ErpAction.READ,
  })
  @Get()
  findAll(@Query() query: PaginationDto) {
    return this.service.findAll(query);
  }

  @RequirePermissions({
    resource: ErpResource.SALES_ORDERS,
    action: ErpAction.READ,
  })
  @Get('column-options')
  async getColumnOptions(
    @Query('column') column: string,
    @Query('search') search: string,
    @Query('page') page: string,
    @Query('pageSize') pageSize: string,
    @Query('filtersStr') filtersStr?: string,
  ) {
    return this.service.getSalesOrdersColumnOptions(
      column,
      search,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
      filtersStr,
    );
  }

  @RequirePermissions({
    resource: ErpResource.SALES_ORDERS,
    action: ErpAction.READ,
  })
  @Get('next-no')
  getNextNo(@Query('date') date?: string) {
    return this.service.getNextSoNo(date);
  }

  @RequirePermissions({
    resource: ErpResource.SALES_ORDERS,
    action: ErpAction.READ,
  })
  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.findOne(id);
  }

  @RequirePermissions({
    resource: ErpResource.SALES_ORDERS,
    action: ErpAction.UPDATE,
  })
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateSalesOrderDto,
  ) {
    return this.service.update(id, dto);
  }

  @RequirePermissions({
    resource: ErpResource.SALES_ORDERS,
    action: ErpAction.UPDATE,
  })
  @Post(':id/reserve')
  reserve(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReserveSalesOrderDto,
  ) {
    return this.service.reserve(id, dto);
  }

  @RequirePermissions({
    resource: ErpResource.SALES_ORDERS,
    action: ErpAction.UPDATE,
  })
  @Post(':id/unreserve')
  unreserve(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UnreserveSalesOrderDto,
  ) {
    return this.service.unreserve(id, dto);
  }

  @RequirePermissions({
    resource: ErpResource.SALES_ORDERS,
    action: ErpAction.UPDATE,
  })
  @Post(':id/confirm-all-delivery')
  confirmAllDelivery(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.confirmAllDelivery(id);
  }

  @RequirePermissions({
    resource: ErpResource.SALES_ORDERS,
    action: ErpAction.DELETE,
  })
  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.remove(id);
  }

  @RequirePermissions({
    resource: ErpResource.SALES_ORDERS,
    action: ErpAction.UPDATE,
  })
  @Post(':id/cancel')
  cancel(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.cancel(id);
  }

  @RequirePermissions({
    resource: ErpResource.SALES_ORDERS,
    action: ErpAction.READ,
  })
  @Get(':id/export/xlsx')
  async exportXlsx(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const buffer = await this.service.exportXlsx(id);
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="DonBanHang_${id.split('-')[0]}.xlsx"`,
    });
    return new StreamableFile(buffer);
  }
}
