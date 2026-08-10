import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DirectusAuthGuard } from '../auth/guards/directus-auth.guard';
import { UserToken } from '../common/decorators/user-token.decorator';
import {
  CreateInventoryItemDto,
  CreateInventoryTransactionDto,
  CreateOperatingExpenseDto,
  CreatePurchaseOrderDto,
  CreateSalesServiceOrderDto,
  OperationalQueryDto,
  PostPurchaseReceiptDto,
  PostSalesIssueDto,
} from './dto/operational-document.dto';
import { OperationalDocumentsService } from './operational-documents.service';

@ApiTags('Operational ERP Documents')
@ApiBearerAuth()
@UseGuards(DirectusAuthGuard)
@Controller()
export class OperationalDocumentsController {
  constructor(private readonly service: OperationalDocumentsService) {}

  @Get('sales-service-orders')
  listSales(@Query() query: OperationalQueryDto, @UserToken() token: string) {
    return this.service.list('sales_service_orders', query, token);
  }

  @Post('sales-service-orders')
  createSales(
    @Body() dto: CreateSalesServiceOrderDto,
    @UserToken() token: string,
  ) {
    return this.service.createSales(dto, token);
  }

  @Post('sales-service-orders/import/kgara')
  importKgara(@Body() dto: any, @UserToken() token: string) {
    return this.service.importKgara(dto, token);
  }

  @Post('sales-service-orders/import/dms')
  importDms(@Body() dto: any, @UserToken() token: string) {
    return this.service.importKgara(
      { ...dto, source_system: 'VINFAST_DMS' },
      token,
    );
  }

  @Get('sales-service-orders/:id')
  getSales(@Param('id') id: string, @UserToken() token: string) {
    return this.service.findOne('sales_service_orders', id, token);
  }

  @Patch('sales-service-orders/:id')
  updateSales(
    @Param('id') id: string,
    @Body() dto: CreateSalesServiceOrderDto,
    @UserToken() token: string,
  ) {
    return this.service.updateDocument('sales_service_orders', id, dto, token);
  }

  @Post('sales-service-orders/:id/issue')
  postSalesIssue(
    @Param('id') id: string,
    @Body() dto: PostSalesIssueDto,
    @UserToken() token: string,
  ) {
    return this.service.postSalesIssue(id, dto, token);
  }

  @Get('purchase-orders')
  listPurchase(
    @Query() query: OperationalQueryDto,
    @UserToken() token: string,
  ) {
    return this.service.list('purchase_orders', query, token);
  }

  @Post('purchase-orders')
  createPurchase(
    @Body() dto: CreatePurchaseOrderDto,
    @UserToken() token: string,
  ) {
    return this.service.createPurchase(dto, token);
  }

  @Get('purchase-orders/:id')
  getPurchase(@Param('id') id: string, @UserToken() token: string) {
    return this.service.findOne('purchase_orders', id, token);
  }

  @Patch('purchase-orders/:id')
  updatePurchase(
    @Param('id') id: string,
    @Body() dto: CreatePurchaseOrderDto,
    @UserToken() token: string,
  ) {
    return this.service.updateDocument('purchase_orders', id, dto, token);
  }

  @Post('purchase-orders/:id/receipt')
  postPurchaseReceipt(
    @Param('id') id: string,
    @Body() dto: PostPurchaseReceiptDto,
    @UserToken() token: string,
  ) {
    return this.service.postPurchaseReceipt(id, dto, token);
  }

  @Get('operational-receivables')
  receivables(@Query() query: OperationalQueryDto, @UserToken() token: string) {
    return this.service.getReceivables(query, token);
  }

  @Get('operational-payables')
  payables(@Query() query: OperationalQueryDto, @UserToken() token: string) {
    return this.service.getPayables(query, token);
  }

  @Get('inventory/items')
  listInventoryItems(
    @Query() query: OperationalQueryDto,
    @UserToken() token: string,
  ) {
    return this.service.listInventoryItems(query, token);
  }

  @Post('inventory/items')
  createInventoryItem(
    @Body() dto: CreateInventoryItemDto,
    @UserToken() token: string,
  ) {
    return this.service.createInventoryItem(dto, token);
  }

  @Get('inventory/transactions')
  listInventoryTransactions(
    @Query() query: OperationalQueryDto,
    @UserToken() token: string,
  ) {
    return this.service.listInventoryTransactions(query, token);
  }

  @Post('inventory/transactions')
  createInventoryTransaction(
    @Body() dto: CreateInventoryTransactionDto,
    @UserToken() token: string,
  ) {
    return this.service.createInventoryTransaction(dto, token);
  }

  @Get('inventory/stock')
  inventoryStock(
    @Query() query: OperationalQueryDto,
    @UserToken() token: string,
  ) {
    return this.service.getInventoryStock(query, token);
  }
}
