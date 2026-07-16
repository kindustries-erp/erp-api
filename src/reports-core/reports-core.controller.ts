import { Controller, Get, Query, UseGuards, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ReportsCoreService } from './reports-core.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../auth/guards/core-rbac.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import type { Response } from 'express';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('reports')
export class ReportsCoreController {
  constructor(private readonly reportsCoreService: ReportsCoreService) {}

  @RequirePermissions({ resource: 'sales_reports', action: 'read' })
  @Get('sales-dashboard')
  async getSalesDashboard(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.reportsCoreService.getSalesDashboard({ dateFrom, dateTo });
  }

  @RequirePermissions({ resource: 'purchasing_reports', action: 'read' })
  @Get('purchasing-dashboard')
  async getPurchasingDashboard(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.reportsCoreService.getPurchasingDashboard({ dateFrom, dateTo });
  }

  @RequirePermissions({ resource: 'sales_reports', action: 'read' })
  @Get('vinfast-parts')
  async getVinfastPartsTracking(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: string,
    @Query('column_search') columnSearch?: string,
    @Query('column_filters') columnFilters?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
  ) {
    const result = await this.reportsCoreService.getVinfastPartsTracking({
      dateFrom,
      dateTo,
      search,
      sortBy,
      sortDir,
      columnSearch,
      columnFilters,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
    return result;
  }

  @RequirePermissions({ resource: 'sales_reports', action: 'read' })
  @Get('vinfast-parts/details')
  async getVinfastPartsTrackingDetails(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('search') search?: string,
    @Query('itemCode') itemCode?: string,
  ) {
    return await this.reportsCoreService.getVinfastPartsTrackingDetails({
      dateFrom,
      dateTo,
      search,
      itemCode,
    });
  }

  @RequirePermissions({ resource: 'sales_reports', action: 'read' })
  @Get('vinfast-parts/column-options')
  async getVinfastPartsColumnOptions(
    @Query('columnKey') columnKey: string,
    @Query('search') search: string = '',
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('filters') filtersStr: string = '{}',
  ) {
    return this.reportsCoreService.getVinfastPartsColumnOptions({
      columnKey,
      search,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      filtersStr,
    });
  }

  @RequirePermissions({ resource: 'sales_reports', action: 'read' })
  @Get('vinfast-parts/export/excel')
  async exportVinfastPartsTrackingExcel(
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Query('search') search: string,
    @Res() res: Response,
  ) {
    const buffer =
      await this.reportsCoreService.exportVinfastPartsTrackingExcel({
        dateFrom,
        dateTo,
        search,
      });
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    const timeStr = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = encodeURIComponent(
      `Báo_cáo_phụ_tùng_VINFAST_${timeStr}.xlsx`,
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${fileName}`,
    );
    res.send(buffer);
  }
}
