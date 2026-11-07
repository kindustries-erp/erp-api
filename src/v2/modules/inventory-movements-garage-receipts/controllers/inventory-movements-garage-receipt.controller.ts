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
import { ErpAction, ErpResource } from '@/v2/core/rbac-core';
import { CreateInventoryMovementsGarageReceiptDto } from '../dto/create-inventory-movements-garage-receipt.dto';
import { UpdateInventoryMovementsGarageReceiptDto } from '../dto/update-inventory-movements-garage-receipt.dto';
import { InventoryMovementsGarageReceiptsService } from '../inventory-movements-garage-receipts.service';

interface RequestWithUser {
  user?: { sub?: string; roles?: string[] };
}

function actorOf(req: RequestWithUser): { id: string; roles: string[] } {
  return { id: req.user?.sub ?? '', roles: req.user?.roles ?? [] };
}

@ApiTags('inventory-movements-garage-receipts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('inventory-movements-garage-receipts')
export class InventoryMovementsGarageReceiptController {
  constructor(
    private readonly service: InventoryMovementsGarageReceiptsService,
  ) {}

  @RequirePermissions({
    resource: ErpResource.GARAGE_STOCK_RECEIPTS,
    action: ErpAction.READ,
  })
  @ApiOperation({ summary: 'Danh sách phiếu nhập kho Garage' })
  @Get()
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.service.list({
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 20,
      search,
      status,
    });
  }

  // Đường dẫn tĩnh đặt trước `:id` để không bị hiểu nhầm là UUID.
  @RequirePermissions({
    resource: ErpResource.GARAGE_STOCK_RECEIPTS,
    action: ErpAction.READ,
  })
  @ApiOperation({ summary: 'Số phiếu kế tiếp trong ngày' })
  @Get('next-no')
  async nextNo(@Query('voucherDate') voucherDate?: string) {
    return { nextNo: await this.service.nextVoucherNo(voucherDate) };
  }

  @RequirePermissions({
    resource: ErpResource.GARAGE_STOCK_RECEIPTS,
    action: ErpAction.READ,
  })
  @ApiOperation({ summary: 'Chi tiết phiếu nhập kho Garage' })
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.service.findOne(id) };
  }

  @RequirePermissions({
    resource: ErpResource.GARAGE_STOCK_RECEIPTS,
    action: ErpAction.CREATE,
  })
  @ApiOperation({ summary: 'Tạo phiếu nhập kho Garage (nháp)' })
  @Post()
  create(
    @Body() dto: CreateInventoryMovementsGarageReceiptDto,
    @Req() req: RequestWithUser,
  ) {
    return this.service.create(actorOf(req), dto);
  }

  @RequirePermissions({
    resource: ErpResource.GARAGE_STOCK_RECEIPTS,
    action: ErpAction.UPDATE,
  })
  @ApiOperation({ summary: 'Sửa phiếu nháp' })
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInventoryMovementsGarageReceiptDto,
  ) {
    return this.service.update(id, dto);
  }

  @RequirePermissions({
    resource: ErpResource.GARAGE_STOCK_RECEIPTS,
    action: ErpAction.UPDATE,
  })
  @ApiOperation({ summary: 'Ghi sổ phiếu nhập: cộng tồn Garage' })
  @Post(':id/post')
  post(@Param('id', ParseUUIDPipe) id: string, @Req() req: RequestWithUser) {
    return this.service.post(id, actorOf(req));
  }

  @RequirePermissions({
    resource: ErpResource.GARAGE_STOCK_RECEIPTS,
    action: ErpAction.UPDATE,
  })
  @ApiOperation({ summary: 'Hủy phiếu đã ghi sổ: đảo tồn' })
  @Post(':id/cancel')
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reason?: string },
    @Req() req: RequestWithUser,
  ) {
    return this.service.cancel(id, actorOf(req), body?.reason ?? null);
  }

  @RequirePermissions({
    resource: ErpResource.GARAGE_STOCK_RECEIPTS,
    action: ErpAction.DELETE,
  })
  @ApiOperation({ summary: 'Xóa mềm phiếu nháp' })
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
