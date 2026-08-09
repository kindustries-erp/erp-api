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
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../auth/guards/core-rbac.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { OperationalQueryDto } from '../operational-documents/dto/operational-document.dto';
import { PurchaseOrdersCoreService } from './purchase-orders-core.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';

@ApiTags('erp_purchase_orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('purchase-orders')
export class PurchaseOrdersCoreController {
  constructor(private readonly service: PurchaseOrdersCoreService) {}

  @RequirePermissions({ resource: 'purchase_orders', action: 'create' })
  @Post()
  create(@Body() dto: CreatePurchaseOrderDto) {
    return this.service.create(dto);
  }

  @RequirePermissions({ resource: 'purchase_orders', action: 'read' })
  @Get()
  findAll(@Query() query: OperationalQueryDto) {
    return this.service.findAll(query);
  }

  @RequirePermissions({ resource: 'purchase_orders', action: 'read' })
  @Get('next-no')
  getNextNo(@Query('date') date?: string) {
    return this.service.getNextPoNo(date);
  }

  @RequirePermissions({ resource: 'purchase_orders', action: 'read' })
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

  @RequirePermissions({ resource: 'purchase_orders', action: 'read' })
  @Get(':id/receipts')
  getReceipts(@Param('id') id: string) {
    return this.service.getReceiptTimeline(id);
  }

  @RequirePermissions({ resource: 'purchase_orders', action: 'read' })
  @Get(':id/connections')
  getConnections(@Param('id') id: string) {
    return this.service.getConnections(id);
  }

  @RequirePermissions({ resource: 'purchase_orders', action: 'read' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @RequirePermissions({ resource: 'purchase_orders', action: 'update' })
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePurchaseOrderDto) {
    return this.service.update(id, dto);
  }

  @RequirePermissions({ resource: 'purchase_orders', action: 'delete' })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @RequirePermissions({ resource: 'purchase_orders', action: 'update' })
  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.service.cancel(id);
  }

  @RequirePermissions({ resource: 'purchase_orders', action: 'read' })
  @Get(':id/invoices')
  getLinkedInvoices(@Param('id') id: string) {
    return this.service.getLinkedInvoices(id);
  }

  @RequirePermissions({ resource: 'purchase_orders', action: 'update' })
  @Post(':id/link-invoices')
  linkInvoices(@Param('id') id: string, @Body() dto: { invoiceIds: string[] }) {
    return this.service.linkInvoices(id, dto.invoiceIds);
  }

  @RequirePermissions({ resource: 'purchase_orders', action: 'update' })
  @Delete(':id/invoices/:invoiceId')
  unlinkInvoice(
    @Param('id') id: string,
    @Param('invoiceId') invoiceId: string,
  ) {
    return this.service.unlinkInvoice(id, invoiceId);
  }
}
