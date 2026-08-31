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
  UseGuards,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../auth/guards/core-rbac.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { ErpResource, ErpAction } from '@/rbac-core/enums';
import { ExecuteProductionDto } from './dto/execute-production.dto';
import { ListProductionDto } from './dto/list-production.dto';
import { StartProductionDto } from './dto/start-production.dto';
import { CompleteProductionDto } from './dto/complete-production.dto';
import { ProductionCoreService } from './production-core.service';

@ApiTags('erp_production')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('production')
export class ProductionCoreController {
  constructor(private readonly service: ProductionCoreService) {}

  @RequirePermissions({
    resource: ErpResource.PRODUCTION,
    action: ErpAction.READ,
  })
  @Get('orders')
  findOrders(@Query() query: ListProductionDto) {
    return this.service.findOrders(query);
  }

  @RequirePermissions({
    resource: ErpResource.PRODUCTION,
    action: ErpAction.CREATE,
  })
  @Post('execute')
  execute(@Body() dto: ExecuteProductionDto) {
    return this.service.execute(dto);
  }

  /** Must be declared before orders/:id to avoid NestJS routing ambiguity */
  @RequirePermissions({
    resource: ErpResource.PRODUCTION,
    action: ErpAction.READ,
  })
  @Get('orders/next-reference-no')
  getNextReferenceNo() {
    return this.service.generateProductionReferenceNo();
  }

  @RequirePermissions({
    resource: ErpResource.PRODUCTION,
    action: ErpAction.READ,
  })
  @Get('orders/column-options')
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

  @RequirePermissions({
    resource: ErpResource.PRODUCTION,
    action: ErpAction.READ,
  })
  @Get('explode-preview')
  explodePreview(
    @Query('bomId', new ParseUUIDPipe()) bomId: string,
    @Query('qtyToProduce') qtyToProduce: number,
  ) {
    return this.service.explodePreview(bomId, qtyToProduce || 1);
  }

  @RequirePermissions({
    resource: ErpResource.PRODUCTION,
    action: ErpAction.READ,
  })
  @Get('orders/:id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.findOne(id);
  }

  @RequirePermissions({
    resource: ErpResource.PRODUCTION,
    action: ErpAction.READ,
  })
  @Get('orders/:id/export-xlsx')
  async exportXlsx(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res() res: Response,
  ) {
    const buffer = await this.service.exportXlsx(id);
    const orderRes = await this.service.findOne(id);
    const refNo = orderRes?.data?.referenceNo || 'LSX';

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="LenhSanXuat_${refNo}.xlsx"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @RequirePermissions({
    resource: ErpResource.PRODUCTION,
    action: ErpAction.UPDATE,
  })
  @Post(':id/cancel')
  cancel(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.cancel(id);
  }

  @RequirePermissions({
    resource: ErpResource.PRODUCTION,
    action: ErpAction.UPDATE,
  })
  @Patch('orders/:id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ExecuteProductionDto,
  ) {
    return this.service.updateDraft(id, dto);
  }

  @RequirePermissions({
    resource: ErpResource.PRODUCTION,
    action: ErpAction.DELETE,
  })
  @Delete('orders/:id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.remove(id);
  }

  @RequirePermissions({
    resource: ErpResource.PRODUCTION,
    action: ErpAction.UPDATE,
  })
  @Post(':id/confirm')
  confirm(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.confirmOrder(id);
  }

  @RequirePermissions({
    resource: ErpResource.PRODUCTION,
    action: ErpAction.UPDATE,
  })
  @Post('orders/:id/start')
  startProduction(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: StartProductionDto,
  ) {
    return this.service.startProduction(id, dto);
  }

  @RequirePermissions({
    resource: ErpResource.PRODUCTION,
    action: ErpAction.UPDATE,
  })
  @Post('orders/:id/complete')
  completeProduction(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CompleteProductionDto,
  ) {
    return this.service.completeProduction(id, dto);
  }

  // --- Shop Floor APIs ---
  @RequirePermissions({
    resource: ErpResource.PRODUCTION,
    action: ErpAction.UPDATE,
  })
  @Post('shop-floor/scan')
  shopFloorScan(@Body() dto: any) {
    return this.service.handleShopFloorScan(dto);
  }
}
