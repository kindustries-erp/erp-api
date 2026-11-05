import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExcludeController,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CoreRbacGuard } from '@/auth/guards/core-rbac.guard';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import { ErpAction } from '@/rbac-core/enums/erp-action.enum';
import { ErpResource } from '@/rbac-core/enums/erp-resource.enum';
import { BaseNextPurchaseOrderNoQueryDto } from '@/v2/core/purchase-orders/dto';
import {
  CreateGaragePurchaseOrderDto,
  QueryGaragePurchaseOrderColumnOptionsDto,
  QueryGaragePurchaseOrdersDto,
  UpdateGaragePurchaseOrderDto,
} from '../dto/garage-purchase-order.dto';
import { GaragePurchaseOrdersService } from '../garage-purchase-orders.service';

/** JWT payload đưa vào `req.user` bởi JwtStrategy (`sub` = id người dùng). */
interface RequestWithUser {
  user?: { sub?: string };
}

/**
 * API v2 PO garage, quyền riêng `garage_purchase_orders`.
 * Route tĩnh khai báo trước `:id`.
 */
/**
 * DEPRECATED: thay bằng garage-procurement-orders (PR → PO, duyệt RBAC, nhận hàng qua phiếu nhập).
 * Giữ để client cũ không gãy trong lúc chuyển đổi; sẽ gỡ sau khi đếm dữ liệu.
 */
@ApiExcludeController()
@ApiTags('garage-purchase-orders-v2')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('api/v2/garage-purchase-orders')
export class GaragePurchaseOrderController {
  constructor(private readonly service: GaragePurchaseOrdersService) {}

  @RequirePermissions({
    resource: ErpResource.GARAGE_PURCHASE_ORDERS,
    action: ErpAction.CREATE,
  })
  @ApiOperation({ summary: 'Tạo đơn mua hàng garage (DRAFT)' })
  @Header('Deprecation', 'true')
  @Post()
  create(
    @Body() dto: CreateGaragePurchaseOrderDto,
    @Req() req: RequestWithUser,
  ) {
    return this.service.create(dto, req.user?.sub ?? null);
  }

  @RequirePermissions({
    resource: ErpResource.GARAGE_PURCHASE_ORDERS,
    action: ErpAction.READ,
  })
  @ApiOperation({ summary: 'Danh sách đơn mua hàng garage' })
  @Header('Deprecation', 'true')
  @Get()
  findAll(@Query() query: QueryGaragePurchaseOrdersDto) {
    return this.service.list(query);
  }

  @RequirePermissions({
    resource: ErpResource.GARAGE_PURCHASE_ORDERS,
    action: ErpAction.READ,
  })
  @ApiOperation({ summary: 'Số đơn mua hàng garage kế tiếp (xem trước)' })
  @Header('Deprecation', 'true')
  @Get('next-no')
  nextNo(@Query() query: BaseNextPurchaseOrderNoQueryDto) {
    return this.service.nextNo(query.date);
  }

  @RequirePermissions({
    resource: ErpResource.GARAGE_PURCHASE_ORDERS,
    action: ErpAction.READ,
  })
  @ApiOperation({ summary: 'Giá trị gợi ý của một cột' })
  @Header('Deprecation', 'true')
  @Get('column-options')
  columnOptions(@Query() query: QueryGaragePurchaseOrderColumnOptionsDto) {
    return this.service.columnOptions(query);
  }

  @RequirePermissions({
    resource: ErpResource.GARAGE_PURCHASE_ORDERS,
    action: ErpAction.READ,
  })
  @Header('Deprecation', 'true')
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @RequirePermissions({
    resource: ErpResource.GARAGE_PURCHASE_ORDERS,
    action: ErpAction.UPDATE,
  })
  @ApiOperation({ summary: 'Sửa header/dòng (không đổi trạng thái)' })
  @Header('Deprecation', 'true')
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGaragePurchaseOrderDto,
  ) {
    return this.service.update(id, dto);
  }

  @RequirePermissions({
    resource: ErpResource.GARAGE_PURCHASE_ORDERS,
    action: ErpAction.DELETE,
  })
  @ApiOperation({ summary: 'Xóa mềm (chỉ khi DRAFT)' })
  @Header('Deprecation', 'true')
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }

  @RequirePermissions({
    resource: ErpResource.GARAGE_PURCHASE_ORDERS,
    action: ErpAction.UPDATE,
  })
  @Header('Deprecation', 'true')
  @Post(':id/approve')
  approve(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.approve(id);
  }

  @RequirePermissions({
    resource: ErpResource.GARAGE_PURCHASE_ORDERS,
    action: ErpAction.UPDATE,
  })
  @Header('Deprecation', 'true')
  @Post(':id/confirm')
  confirm(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.confirm(id);
  }

  @RequirePermissions({
    resource: ErpResource.GARAGE_PURCHASE_ORDERS,
    action: ErpAction.UPDATE,
  })
  @Header('Deprecation', 'true')
  @Post(':id/cancel')
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.cancel(id);
  }
}
