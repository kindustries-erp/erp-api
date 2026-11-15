import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CoreRbacGuard } from '@/auth/guards/core-rbac.guard';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import { ErpAction, ErpResource } from '@/v2/core/rbac-core';
import {
  QueryStockVoucherUnionDto,
  QueryStockVoucherUnionOptionsDto,
  StockVoucherUnionListResponseDto,
} from '@/v2/core/inventory-movements-core';
import { InventoryMovementsGarageVouchersService } from '../inventory-movements-garage-vouchers.service';

@ApiTags('inventory-movements-garage-vouchers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('api/v2/inventory-movements-garage-vouchers')
export class InventoryMovementsGarageVouchersController {
  constructor(
    private readonly service: InventoryMovementsGarageVouchersService,
  ) {}

  @RequirePermissions({
    resource: ErpResource.GARAGE_STOCK_VOUCHERS,
    action: ErpAction.READ,
  })
  @ApiOperation({ summary: 'Danh sách chứng từ kho Garage (gộp 4 loại)' })
  @ApiOkResponse({ type: StockVoucherUnionListResponseDto })
  @Get()
  list(@Query() query: QueryStockVoucherUnionDto) {
    return this.service.list(query);
  }

  @RequirePermissions({
    resource: ErpResource.GARAGE_STOCK_VOUCHERS,
    action: ErpAction.READ,
  })
  @ApiOperation({ summary: 'Gợi ý giá trị cột cho bộ lọc tiêu đề bảng' })
  @Get('column-options')
  columnOptions(@Query() query: QueryStockVoucherUnionOptionsDto) {
    return this.service.columnOptions(query);
  }
}
