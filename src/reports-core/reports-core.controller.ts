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

  @RequirePermissions({ resource: 'vinfast_parts_reports', action: 'read' })
  @Get('vinfast-parts-dashboard')
  async getVinfastPartsDashboard(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('vehicleType') vehicleType?: string,
    @Query('groupBy') groupBy?: string,
    @Query('itemCode') itemCode?: string,
  ) {
    return this.reportsCoreService.getVinfastPartsDashboard({
      dateFrom,
      dateTo,
      vehicleType,
      groupBy,
      itemCode,
    });
  }

  @RequirePermissions({ resource: 'vinfast_parts_reports', action: 'read' })
  @Get('vinfast-parts-dashboard-table')
  async getVinfastPartsDashboardTable(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('vehicleType') vehicleType?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
    @Query('column_search') columnSearch?: string,
    @Query('column_filters') columnFilters?: string,
    @Query('sorts') sorts?: string,
  ) {
    return this.reportsCoreService.getVinfastPartsDashboardTable({
      dateFrom,
      dateTo,
      vehicleType,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      columnSearch,
      columnFilters,
      sorts,
    });
  }

  @RequirePermissions({ resource: 'vinfast_parts_reports', action: 'read' })
  @Get('vinfast-parts')
  async getVinfastPartsTracking(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: string,
    @Query('sorts') sorts?: string,
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
      sorts,
      columnSearch,
      columnFilters,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
    return result;
  }

  @RequirePermissions({ resource: 'vinfast_parts_reports', action: 'read' })
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

  @RequirePermissions({ resource: 'vinfast_parts_reports', action: 'read' })
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

  @RequirePermissions({ resource: 'vinfast_parts_reports', action: 'read' })
  @Get('vinfast-parts/export/excel')
  async exportVinfastPartsTrackingExcel(
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Query('search') search: string,
    @Query('sorts') sorts: string,
    @Query('column_search') columnSearch: string,
    @Query('column_filters') columnFilters: string,
    @Res() res: Response,
  ) {
    const buffer =
      await this.reportsCoreService.exportVinfastPartsTrackingExcel({
        dateFrom,
        dateTo,
        search,
        sorts,
        columnSearch,
        columnFilters,
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

  // ---------------------------------------------------------------------------
  // VINFAST SETTLEMENT ORDERS
  // ---------------------------------------------------------------------------

  @RequirePermissions({ resource: 'vinfast_parts_reports', action: 'read' })
  @Get('settlement-orders')
  async getSettlementOrders(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('search') search?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: string,
    @Query('columnSearch') columnSearch?: string,
    @Query('columnFilters') columnFilters?: string,
  ) {
    return this.reportsCoreService.getSettlementOrders({
      dateFrom,
      dateTo,
      search,
      page,
      limit,
      sortBy,
      sortDir,
      columnSearch,
      columnFilters,
    });
  }

  @RequirePermissions({ resource: 'vinfast_parts_reports', action: 'read' })
  @Get('settlement-orders/export/excel')
  async exportSettlementOrdersExcel(
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Query('search') search: string,
    @Query('sortBy') sortBy: string,
    @Query('sortDir') sortDir: string,
    @Query('columnFilters') columnFilters: string,
    @Res() res: any,
  ) {
    const buffer = await this.reportsCoreService.exportSettlementOrdersExcel({
      dateFrom,
      dateTo,
      search,
      sortBy,
      sortDir,
      columnFilters,
    });
    const fileName = `Lenh_Quyet_Toan_VF_${Date.now()}.xlsx`;
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    });
    res.send(buffer);
  }

  @RequirePermissions({ resource: 'vinfast_parts_reports', action: 'read' })
  @Get('settlement-orders/details')
  async getSettlementOrderDetails(
    @Query('settlementOrder') settlementOrder: string,
    @Query('period') period: string,
  ) {
    return this.reportsCoreService.getSettlementOrderDetails({
      settlementOrder,
      period,
    });
  }

  @RequirePermissions({ resource: 'vinfast_parts_reports', action: 'read' })
  @Get('settlement-orders/column-options')
  async getSettlementOrderColumnOptions(
    @Query('columnKey') columnKey: string,
    @Query('search') search: string = '',
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('filters') filtersStr: string = '{}',
  ) {
    return this.reportsCoreService.getSettlementOrderColumnOptions({
      columnKey,
      search,
      page,
      limit,
      filtersStr,
    });
  }
}
