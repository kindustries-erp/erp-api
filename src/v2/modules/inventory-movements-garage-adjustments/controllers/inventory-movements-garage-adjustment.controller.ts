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
import { CreateInventoryMovementsGarageAdjustmentDto } from '../dto/create-inventory-movements-garage-adjustment.dto';
import { UpdateInventoryMovementsGarageAdjustmentDto } from '../dto/update-inventory-movements-garage-adjustment.dto';
import { InventoryMovementsGarageAdjustmentsService } from '../inventory-movements-garage-adjustments.service';

interface RequestWithUser {
  user?: { sub?: string; roles?: string[] };
}

function actorOf(req: RequestWithUser): { id: string; roles: string[] } {
  return { id: req.user?.sub ?? '', roles: req.user?.roles ?? [] };
}

@ApiTags('inventory-movements-garage-adjustments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('inventory-movements-garage-adjustments')
export class InventoryMovementsGarageAdjustmentController {
  constructor(
    private readonly service: InventoryMovementsGarageAdjustmentsService,
  ) {}

  @RequirePermissions({
    resource: ErpResource.GARAGE_STOCK_ADJUSTMENTS,
    action: ErpAction.READ,
  })
  @ApiOperation({ summary: 'Danh sách phiếu điều chỉnh kho Garage' })
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
    resource: ErpResource.GARAGE_STOCK_ADJUSTMENTS,
    action: ErpAction.READ,
  })
  @ApiOperation({ summary: 'Số phiếu kế tiếp trong ngày' })
  @Get('next-no')
  async nextNo(@Query('voucherDate') voucherDate?: string) {
    return { nextNo: await this.service.nextVoucherNo(voucherDate) };
  }

  @RequirePermissions({
    resource: ErpResource.GARAGE_STOCK_ADJUSTMENTS,
    action: ErpAction.READ,
  })
  @ApiOperation({ summary: 'Chi tiết phiếu điều chỉnh kho Garage' })
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.service.findOne(id) };
  }

  @RequirePermissions({
    resource: ErpResource.GARAGE_STOCK_ADJUSTMENTS,
    action: ErpAction.CREATE,
  })
  @ApiOperation({ summary: 'Tạo phiếu điều chỉnh kho Garage (nháp)' })
  @Post()
  create(
    @Body() dto: CreateInventoryMovementsGarageAdjustmentDto,
    @Req() req: RequestWithUser,
  ) {
    return this.service.create(actorOf(req), dto);
  }

  @RequirePermissions({
    resource: ErpResource.GARAGE_STOCK_ADJUSTMENTS,
    action: ErpAction.UPDATE,
  })
  @ApiOperation({ summary: 'Sửa phiếu nháp' })
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInventoryMovementsGarageAdjustmentDto,
  ) {
    return this.service.update(id, dto);
  }

  @RequirePermissions({
    resource: ErpResource.GARAGE_STOCK_ADJUSTMENTS,
    action: ErpAction.UPDATE,
  })
  @ApiOperation({
    summary: 'Ghi sổ phiếu điều chỉnh: cộng hoặc trừ tồn Garage theo dòng',
  })
  @Post(':id/post')
  post(@Param('id', ParseUUIDPipe) id: string, @Req() req: RequestWithUser) {
    return this.service.post(id, actorOf(req));
  }

  @RequirePermissions({
    resource: ErpResource.GARAGE_STOCK_ADJUSTMENTS,
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
    resource: ErpResource.GARAGE_STOCK_ADJUSTMENTS,
    action: ErpAction.DELETE,
  })
  @ApiOperation({ summary: 'Xóa mềm phiếu nháp' })
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
