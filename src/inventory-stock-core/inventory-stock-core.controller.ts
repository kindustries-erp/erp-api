import { Controller, Get, Query, UseGuards, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../auth/guards/core-rbac.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { InventoryStockCoreService } from './inventory-stock-core.service';
import { InventoryStockQueryDto } from './dto/inventory-stock-query.dto';

@ApiTags('inventory_stock')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('inventory/stock')
export class InventoryStockCoreController {
  constructor(private readonly service: InventoryStockCoreService) {}

  @RequirePermissions({ resource: 'inventory_items', action: 'read' })
  @Get()
  findAll(@Query() query: InventoryStockQueryDto) {
    return this.service.findAll(query);
  }

  @RequirePermissions({ resource: 'inventory_items', action: 'read' })
  @Get('column-options')
  getColumnOptions(
    @Query('column') column: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('filters') filters?: string,
  ) {
    return this.service.getColumnOptions(
      column,
      search,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
      filters,
    );
  }

  @RequirePermissions({ resource: 'inventory_items', action: 'read' })
  @Get('export/excel')
  async exportExcel(
    @Query() query: InventoryStockQueryDto,
    @Res() res: Response,
  ) {
    const buffer = await this.service.exportExcel(query as any);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=inventory_stock.xlsx',
    );
    res.send(buffer);
  }
}
