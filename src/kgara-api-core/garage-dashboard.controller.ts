import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Res,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags, ApiProduces } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../auth/guards/core-rbac.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { GarageDashboardService } from './garage-dashboard.service';
import { GarageOpexService } from './services/garage-opex.service';
import {
  CreateGarageOpexDto,
  UpdateGarageOpexDto,
  ApplyRecurringOpexDto,
  ListGarageOpexQueryDto,
} from './dto/garage-opex.dto';

@ApiTags('garage_dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('greenway/dashboard')
export class GarageDashboardController {
  constructor(
    private readonly service: GarageDashboardService,
    private readonly opexService: GarageOpexService,
  ) {}

  @RequirePermissions({ resource: 'garage', action: 'read' })
  @Get('stats')
  @ApiQuery({ name: 'date_from', required: false })
  @ApiQuery({ name: 'date_to', required: false })
  getDashboardStats(
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
  ) {
    return this.service.getDashboardStats(dateFrom, dateTo);
  }

  @RequirePermissions({ resource: 'garage', action: 'read' })
  @Get('checkpoint-kpis')
  getCheckpointKpis() {
    return this.service.getCheckpointKpis();
  }

  @RequirePermissions({ resource: 'garage', action: 'read' })
  @Get('checkpoint-cases')
  @ApiQuery({ name: 'date_from', required: true })
  @ApiQuery({ name: 'date_to', required: true })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  getCheckpointCases(
    @Query('date_from') dateFrom: string,
    @Query('date_to') dateTo: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.getCheckpointCases(
      dateFrom,
      dateTo,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
    );
  }

  @RequirePermissions({ resource: 'garage', action: 'read' })
  @Get('customers')
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'date_from', required: false })
  @ApiQuery({ name: 'date_to', required: false })
  @ApiQuery({ name: 'sortBy', required: false })
  @ApiQuery({ name: 'sortOrder', required: false })
  @ApiQuery({ name: 'column_search', required: false })
  @ApiQuery({ name: 'column_filters', required: false })
  getCustomersStats(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'ASC' | 'DESC',
    @Query('column_search') columnSearch?: string,
    @Query('column_filters') columnFilters?: string,
  ) {
    return this.service.getCustomersStats(
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
      search,
      dateFrom,
      dateTo,
      sortBy,
      sortOrder,
      columnSearch,
      columnFilters,
    );
  }

  @RequirePermissions({ resource: 'garage', action: 'read' })
  @Get('export')
  @ApiProduces(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @ApiQuery({ name: 'date_from', required: false })
  @ApiQuery({ name: 'date_to', required: false })
  async exportExcel(
    @Res() res: Response,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
  ) {
    const buffer = await this.service.exportExcel(dateFrom, dateTo);
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition':
        'attachment; filename="Garage_Dashboard_Report.xlsx"',
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  // ===================== OPERATING EXPENSES (CP VẬN HÀNH) =====================

  @RequirePermissions({ resource: 'garage', action: 'read' })
  @Get('opex')
  getOpexList(@Query() query: ListGarageOpexQueryDto) {
    return this.opexService.getList(query);
  }

  @RequirePermissions({ resource: 'garage', action: 'read' })
  @Get('opex/column-options')
  @ApiQuery({ name: 'column', required: true })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiQuery({ name: 'filtersStr', required: false })
  getOpexColumnOptions(
    @Query('column') column: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('filtersStr') filtersStr?: string,
  ) {
    return this.opexService.getColumnOptions(
      column,
      search,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
      filtersStr,
    );
  }

  @RequirePermissions({ resource: 'garage', action: 'read' })
  @Get('opex/:id')
  getOpexById(@Param('id') id: string) {
    return this.opexService.getById(id);
  }

  @RequirePermissions({ resource: 'garage', action: 'create' })
  @Post('opex')
  createOpex(@Body() dto: CreateGarageOpexDto, @Req() req: any) {
    return this.opexService.create(dto, req.user?.id);
  }

  @RequirePermissions({ resource: 'garage', action: 'update' })
  @Put('opex/:id')
  updateOpex(@Param('id') id: string, @Body() dto: UpdateGarageOpexDto) {
    return this.opexService.update(id, dto);
  }

  @RequirePermissions({ resource: 'garage', action: 'update' })
  @Post('opex/:id/apply-recurring')
  applyRecurringOpex(
    @Param('id') id: string,
    @Body() dto: ApplyRecurringOpexDto,
    @Req() req: any,
  ) {
    return this.opexService.applyRecurring(id, dto, req.user?.id);
  }

  @RequirePermissions({ resource: 'garage', action: 'delete' })
  @Delete('opex/:id')
  deleteOpex(@Param('id') id: string) {
    return this.opexService.delete(id);
  }

  // ===================== P&L REPORT =====================

  @RequirePermissions({ resource: 'garage', action: 'read' })
  @Get('pnl-report')
  @ApiQuery({ name: 'year', required: false })
  @ApiQuery({ name: 'month', required: false })
  getPnlReport(@Query('year') year?: string, @Query('month') month?: string) {
    return this.service.getPnlReport(
      year ? parseInt(year, 10) : undefined,
      month ? parseInt(month, 10) : undefined,
    );
  }

  @RequirePermissions({ resource: 'garage', action: 'read' })
  @Get('pnl-report/export')
  @ApiProduces(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @ApiQuery({ name: 'year', required: false })
  @ApiQuery({ name: 'month', required: false })
  async exportPnlExcel(
    @Res() res: Response,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const y = year ? parseInt(year, 10) : new Date().getFullYear();
    const m = month ? parseInt(month, 10) : new Date().getMonth() + 1;
    const buffer = await this.service.exportPnlExcel(y, m);
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="Garage_PNL_Report_${String(m).padStart(2, '0')}_${y}.xlsx"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}
