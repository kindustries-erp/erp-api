import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../../auth/guards/core-rbac.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { ErpAction, ErpResource } from '@/rbac-core/enums';
import { VinfastPartsService } from '../vinfast-parts.service';

@ApiTags('VinFast Parts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('vinfast-parts')
export class VinfastPartsStockController {
  constructor(private readonly vinfastPartsService: VinfastPartsService) {}

  @Get('stock')
  @RequirePermissions({ resource: ErpResource.VINFAST, action: ErpAction.READ })
  @ApiOperation({ summary: 'Get VinFast parts stock balance' })
  @ApiQuery({ name: 'vehicleType', required: false })
  @ApiQuery({ name: 'stockTab', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'sortBy', required: false })
  @ApiQuery({ name: 'sortDir', required: false })
  @ApiQuery({ name: 'sorts', required: false })
  @ApiQuery({ name: 'column_search', required: false })
  @ApiQuery({ name: 'column_filters', required: false })
  async getStock(
    @Query('vehicleType') vehicleType?: string,
    @Query('stockTab') stockTab?: string,
    @Query('stock_tab') stockTabSnake?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: string,
    @Query('sorts') sorts?: string,
    @Query('column_search') columnSearch?: string,
    @Query('column_filters') columnFilters?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 50;
    const effectiveStockTab = stockTab || stockTabSnake;
    return this.vinfastPartsService.getPartsStock(
      vehicleType,
      pageNum,
      limitNum,
      search,
      sortBy,
      sortDir,
      sorts,
      columnSearch,
      columnFilters,
      effectiveStockTab,
    );
  }

  @Get('stock/column-options')
  @RequirePermissions({ resource: ErpResource.VINFAST, action: ErpAction.READ })
  @ApiOperation({
    summary: 'Get VinFast parts stock column options for filter',
  })
  @ApiQuery({ name: 'stockTab', required: false })
  @ApiQuery({ name: 'stock_tab', required: false })
  async getStockColumnOptions(
    @Query('columnKey') columnKey: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('filters') filters?: string,
    @Query('vehicleType') vehicleType?: string,
    @Query('stockTab') stockTab?: string,
    @Query('stock_tab') stockTabSnake?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    const effectiveStockTab = stockTab || stockTabSnake;
    return this.vinfastPartsService.getStockColumnOptions(
      columnKey,
      search,
      pageNum,
      limitNum,
      filters,
      vehicleType,
      effectiveStockTab,
    );
  }
}
