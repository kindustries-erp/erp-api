import {
  Body,
  Controller,
  Get,
  MessageEvent,
  Param,
  Post,
  Query,
  Request,
  Res,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ReportsCoreService } from './reports-core.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../auth/guards/core-rbac.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import type { Response } from 'express';
import { Observable } from 'rxjs';
import type { VinfastPartsExportQuery } from './services/vinfast-parts-export-background.service';

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
  @Get('vinfast-parts-dashboard-table/column-options')
  async getVinfastPartsDashboardTableColumnOptions(
    @Query('columnKey') columnKey: string,
    @Query('search') search: string = '',
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('filters') filtersStr: string = '{}',
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('vehicleType') vehicleType?: string,
  ) {
    return this.reportsCoreService.getVinfastPartsDashboardTableColumnOptions({
      columnKey,
      search,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      filtersStr,
      dateFrom,
      dateTo,
      vehicleType,
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
  @Post('vinfast-parts/export/excel/background')
  startVinfastPartsExportBackground(
    @Body() query: VinfastPartsExportQuery,
    @Request() req: any,
  ) {
    return this.reportsCoreService.startVinfastPartsExportBackground(
      query,
      req.user?.sub,
    );
  }

  @RequirePermissions({ resource: 'vinfast_parts_reports', action: 'read' })
  @Get('vinfast-parts/export/excel/background/history')
  getVinfastPartsExportBackgroundHistory(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.reportsCoreService.getVinfastPartsExportHistory(
      req.user?.sub,
      page ? Number(page) : undefined,
      pageSize ? Number(pageSize) : undefined,
    );
  }

  @RequirePermissions({ resource: 'vinfast_parts_reports', action: 'read' })
  @Get('vinfast-parts/export/excel/background/:jobId/download')
  async downloadVinfastPartsBackgroundExport(
    @Param('jobId') jobId: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    const { buffer, fileName } =
      this.reportsCoreService.getVinfastPartsExportBackgroundFile(
        jobId,
        req.user?.sub,
      );

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  }

  @Sse('vinfast-parts/export/excel/progress/stream')
  vinfastPartsExportProgressStream(
    @Request() req: any,
  ): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      subscriber.next({
        data: JSON.stringify({
          processId: 'ping',
          current: 0,
          total: 100,
          isRunning: false,
          completed: false,
          ready: false,
          failed: false,
          message: 'Connected',
        }),
      } as MessageEvent);

      const snapshot =
        this.reportsCoreService.getVinfastPartsExportProgressSnapshot(
          req.user?.sub,
        );
      if (snapshot) {
        subscriber.next({ data: JSON.stringify(snapshot) } as MessageEvent);
      }

      const intervalId = setInterval(() => {
        subscriber.next({
          data: JSON.stringify({
            processId: 'ping',
            current: 0,
            total: 100,
            isRunning: false,
            completed: false,
            ready: false,
            failed: false,
            message: 'Ping',
          }),
        } as MessageEvent);
      }, 15000);

      const subscription =
        this.reportsCoreService.vinfastPartsExportProgress$.subscribe({
          next: (data) => {
            if (data.userId !== req.user?.sub) return;
            subscriber.next({ data: JSON.stringify(data) } as MessageEvent);
          },
          error: (err) => subscriber.error(err),
          complete: () => subscriber.complete(),
        });

      return () => {
        clearInterval(intervalId);
        subscription.unsubscribe();
      };
    });
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
