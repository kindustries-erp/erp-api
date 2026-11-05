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
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CoreRbacGuard } from '@/auth/guards/core-rbac.guard';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import { ErpAction, ErpResource } from '@/v2/core/rbac';
import {
  CreatePurchaseOrderDto,
  LinkInvoicesDto,
  NextPurchaseOrderNoQueryDto,
  QueryPurchaseOrderColumnOptionsDto,
  QueryPurchaseOrdersDto,
  UpdatePurchaseOrderDto,
} from '../dto/purchase-order.dto';
import { PurchaseOrdersService } from '../purchase-orders.service';

/** JWT payload đưa vào `req.user` bởi JwtStrategy (`sub` = id người dùng). */
interface RequestWithUser {
  user?: { sub?: string };
}

/**
 * API v2 PO. Đổi trạng thái đi qua POST :id/approve|confirm|cancel, không qua PATCH.
 * Route tĩnh (next-no, column-options) khai báo TRƯỚC `:id` để không bị hiểu là id.
 */
@ApiTags('purchase-orders-v2')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('api/v2/purchase-orders')
export class PurchaseOrderController {
  constructor(private readonly service: PurchaseOrdersService) {}

  @RequirePermissions({
    resource: ErpResource.PURCHASE_ORDERS,
    action: ErpAction.CREATE,
  })
  @ApiOperation({ summary: 'Tạo đơn mua hàng (DRAFT)' })
  @Post()
  create(@Body() dto: CreatePurchaseOrderDto, @Req() req: RequestWithUser) {
    return this.service.create(dto, req.user?.sub ?? null);
  }

  @RequirePermissions({
    resource: ErpResource.PURCHASE_ORDERS,
    action: ErpAction.READ,
  })
  @ApiOperation({ summary: 'Danh sách đơn mua hàng (phân trang, lọc, tổng)' })
  @Get()
  findAll(@Query() query: QueryPurchaseOrdersDto) {
    return this.service.list(query);
  }

  @RequirePermissions({
    resource: ErpResource.PURCHASE_ORDERS,
    action: ErpAction.READ,
  })
  @ApiOperation({ summary: 'Số đơn mua hàng kế tiếp (xem trước)' })
  @Get('next-no')
  nextNo(@Query() query: NextPurchaseOrderNoQueryDto) {
    return this.service.nextNo(query.date);
  }

  @RequirePermissions({
    resource: ErpResource.PURCHASE_ORDERS,
    action: ErpAction.READ,
  })
  @ApiOperation({ summary: 'Giá trị gợi ý của một cột' })
  @Get('column-options')
  columnOptions(@Query() query: QueryPurchaseOrderColumnOptionsDto) {
    return this.service.columnOptions(query);
  }

  @RequirePermissions({
    resource: ErpResource.PURCHASE_ORDERS,
    action: ErpAction.READ,
  })
  @Get(':id/receipts')
  receipts(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.receipts(id);
  }

  @RequirePermissions({
    resource: ErpResource.PURCHASE_ORDERS,
    action: ErpAction.READ,
  })
  @Get(':id/connections')
  connections(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.connections(id);
  }

  @RequirePermissions({
    resource: ErpResource.PURCHASE_ORDERS,
    action: ErpAction.READ,
  })
  @Get(':id/invoices')
  invoices(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.invoices(id);
  }

  @RequirePermissions({
    resource: ErpResource.PURCHASE_ORDERS,
    action: ErpAction.UPDATE,
  })
  @Post(':id/link-invoices')
  linkInvoices(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LinkInvoicesDto,
  ) {
    return this.service.linkInvoices(id, dto.invoiceIds);
  }

  @RequirePermissions({
    resource: ErpResource.PURCHASE_ORDERS,
    action: ErpAction.UPDATE,
  })
  @Delete(':id/invoices/:invoiceId')
  unlinkInvoice(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
  ) {
    return this.service.unlinkInvoice(id, invoiceId);
  }

  @RequirePermissions({
    resource: ErpResource.PURCHASE_ORDERS,
    action: ErpAction.READ,
  })
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @RequirePermissions({
    resource: ErpResource.PURCHASE_ORDERS,
    action: ErpAction.UPDATE,
  })
  @ApiOperation({ summary: 'Sửa header/dòng (không đổi trạng thái)' })
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePurchaseOrderDto,
  ) {
    return this.service.update(id, dto);
  }

  @RequirePermissions({
    resource: ErpResource.PURCHASE_ORDERS,
    action: ErpAction.DELETE,
  })
  @ApiOperation({ summary: 'Xóa mềm (chỉ khi DRAFT)' })
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }

  @RequirePermissions({
    resource: ErpResource.PURCHASE_ORDERS,
    action: ErpAction.UPDATE,
  })
  @Post(':id/approve')
  approve(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.approve(id);
  }

  @RequirePermissions({
    resource: ErpResource.PURCHASE_ORDERS,
    action: ErpAction.UPDATE,
  })
  @Post(':id/confirm')
  confirm(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.confirm(id);
  }

  @RequirePermissions({
    resource: ErpResource.PURCHASE_ORDERS,
    action: ErpAction.UPDATE,
  })
  @Post(':id/cancel')
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.cancel(id);
  }
}
