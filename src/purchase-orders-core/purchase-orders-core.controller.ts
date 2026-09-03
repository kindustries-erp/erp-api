import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Delete,
  Query,
  UseGuards,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../auth/guards/core-rbac.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { ErpResource, ErpAction } from '@/rbac-core/enums';
import { OperationalQueryDto } from '../operational-documents/dto/operational-document.dto';
import { PurchaseOrdersCoreService } from './purchase-orders-core.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { QueryPurchaseOrderItemsDto } from './dto/query-purchase-order-items.dto';
import { ExportPurchaseOrdersRangeDto } from './dto/export-purchase-orders-range.dto';

@ApiTags('erp_purchase_orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('purchase-orders')
export class PurchaseOrdersCoreController {
  constructor(private readonly service: PurchaseOrdersCoreService) {}

  @RequirePermissions({
    resource: ErpResource.PURCHASE_ORDERS,
    action: ErpAction.CREATE,
  })
  @Post()
  create(@Body() dto: CreatePurchaseOrderDto) {
    return this.service.create(dto);
  }

  @RequirePermissions({
    resource: ErpResource.PURCHASE_ORDERS,
    action: ErpAction.READ,
  })
  @Get()
  findAll(@Query() query: OperationalQueryDto) {
    return this.service.findAll(query);
  }

  @RequirePermissions({
    resource: ErpResource.PURCHASE_ORDERS,
    action: ErpAction.READ,
  })
  @Get('next-no')
  getNextNo(@Query('date') date?: string) {
    return this.service.getNextPoNo(date);
  }

  @RequirePermissions({
    resource: ErpResource.PURCHASE_ORDERS,
    action: ErpAction.READ,
  })
  @Get('column-options')
  async getColumnOptions(
    @Query('column') column: string,
    @Query('search') search?: string,
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '20',
    @Query('filters') filters?: string,
  ) {
    return this.service.getColumnOptions(
      column,
      search,
      parseInt(page, 10),
      parseInt(pageSize, 10),
      filters,
    );
  }

  @RequirePermissions({
    resource: ErpResource.PURCHASE_ORDERS,
    action: ErpAction.READ,
  })
  @Get('items/column-options')
  async getItemsColumnOptions(
    @Query('column') column: string,
    @Query('search') search?: string,
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '20',
    @Query('filters') filters?: string,
    @Query('supplier_id') supplierId?: string,
  ) {
    return this.service.getItemsColumnOptions(
      column,
      search,
      parseInt(page, 10),
      parseInt(pageSize, 10),
      filters,
      supplierId,
    );
  }

  @RequirePermissions({
    resource: ErpResource.PURCHASE_ORDERS,
    action: ErpAction.READ,
  })
  @Get('items')
  findAllItems(@Query() query: QueryPurchaseOrderItemsDto) {
    return this.service.findAllItems(query);
  }

  @RequirePermissions({
    resource: ErpResource.PURCHASE_ORDERS,
    action: ErpAction.READ,
  })
  @Get('supplier-stats/:supplierId')
  getSupplierStats(@Param('supplierId') supplierId: string) {
    return this.service.getSupplierStats(supplierId);
  }

  @RequirePermissions({
    resource: ErpResource.PURCHASE_ORDERS,
    action: ErpAction.READ,
  })
  @Get(':id/receipts')
  getReceipts(@Param('id') id: string) {
    return this.service.getReceiptTimeline(id);
  }

  @RequirePermissions({
    resource: ErpResource.PURCHASE_ORDERS,
    action: ErpAction.READ,
  })
  @Get('export/excel/range')
  async exportExcelRange(
    @Query() query: ExportPurchaseOrdersRangeDto,
    @Res() res: Response,
  ) {
    const buffer = await this.service.exportPoExcelRange(query);
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const filename = `bang-ke-mua-hang-theo-ky_${timestamp}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(buffer);
  }

  @RequirePermissions({
    resource: ErpResource.PURCHASE_ORDERS,
    action: ErpAction.READ,
  })
  @Get(':id/connections')
  getConnections(@Param('id') id: string) {
    return this.service.getConnections(id);
  }

  @RequirePermissions({
    resource: ErpResource.PURCHASE_ORDERS,
    action: ErpAction.READ,
  })
  @Get(':id/export/excel')
  async exportExcel(@Param('id') id: string, @Res() res: Response) {
    const buffer = await this.service.exportPoExcel(id);
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=purchase-order-${id}_${timestamp}.xlsx`,
    );
    res.send(buffer);
  }

  @RequirePermissions({
    resource: ErpResource.PURCHASE_ORDERS,
    action: ErpAction.READ,
  })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @RequirePermissions({
    resource: ErpResource.PURCHASE_ORDERS,
    action: ErpAction.UPDATE,
  })
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePurchaseOrderDto) {
    return this.service.update(id, dto);
  }

  @RequirePermissions({
    resource: ErpResource.PURCHASE_ORDERS,
    action: ErpAction.DELETE,
  })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @RequirePermissions({
    resource: ErpResource.PURCHASE_ORDERS,
    action: ErpAction.UPDATE,
  })
  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.service.cancel(id);
  }

  @RequirePermissions({
    resource: ErpResource.PURCHASE_ORDERS,
    action: ErpAction.READ,
  })
  @Get(':id/invoices')
  getLinkedInvoices(@Param('id') id: string) {
    return this.service.getLinkedInvoices(id);
  }

  @RequirePermissions({
    resource: ErpResource.PURCHASE_ORDERS,
    action: ErpAction.UPDATE,
  })
  @Post(':id/link-invoices')
  linkInvoices(@Param('id') id: string, @Body() dto: { invoiceIds: string[] }) {
    return this.service.linkInvoices(id, dto.invoiceIds);
  }

  @RequirePermissions({
    resource: ErpResource.PURCHASE_ORDERS,
    action: ErpAction.UPDATE,
  })
  @Delete(':id/invoices/:invoiceId')
  unlinkInvoice(
    @Param('id') id: string,
    @Param('invoiceId') invoiceId: string,
  ) {
    return this.service.unlinkInvoice(id, invoiceId);
  }
}
