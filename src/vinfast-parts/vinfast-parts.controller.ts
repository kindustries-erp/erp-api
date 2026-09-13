import {
  Controller,
  Post,
  Body,
  Sse,
  MessageEvent,
  Get,
  Query,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  VinfastPartsStockExportBackgroundService,
  VinfastPartsStockExportQuery,
} from './services/vinfast-parts-stock-export-background.service';
import { Request, Res } from '@nestjs/common';
import type { Response } from 'express';
import { VinfastPartsService } from './vinfast-parts.service';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('VinFast Parts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('vinfast-parts')
export class VinfastPartsController {
  constructor(
    private readonly vinfastPartsService: VinfastPartsService,
    private readonly exportService: VinfastPartsStockExportBackgroundService,
  ) {}

  @Post('sync-catalog')
  @ApiOperation({ summary: 'Sync VinFast parts catalog from invoice history' })
  async syncCatalog() {
    return this.vinfastPartsService.syncCatalog();
  }

  @Post('sync-ledger')
  @ApiOperation({ summary: 'Sync VinFast parts ledger from invoice history' })
  async syncLedger(
    @Body() body: { dateFrom?: string; dateTo?: string; clearDb?: boolean },
  ) {
    // We pass the service's own progress$ subject so SSE clients can listen to it
    // Run async to not block the request, or we can await it.
    // Let's run it async so the SSE connection can stream.
    this.vinfastPartsService
      .syncCatalog({
        progress$: this.vinfastPartsService.progress$,
        dateFrom: body.dateFrom,
        dateTo: body.dateTo,
        clearDb: body.clearDb,
      })
      .then(() =>
        this.vinfastPartsService.syncLedger({
          progress$: this.vinfastPartsService.progress$,
          dateFrom: body.dateFrom,
          dateTo: body.dateTo,
        }),
      )
      .catch((e) => console.error('Sync failed', e));

    return { message: 'Sync started' };
  }

  @Get('stock')
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

  @Get('ledger/:sku')
  @ApiOperation({ summary: 'Get VinFast parts ledger history (FIFO trace)' })
  async getLedgerHistory(@Param('sku') sku: string) {
    return this.vinfastPartsService.getPartLedgerHistory(sku);
  }

  @Get('fifo-rows/:sku')
  @ApiOperation({ summary: 'Get VinFast parts FIFO unit ledger rows' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getFifoUnitRows(
    @Param('sku') sku: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 100;
    return this.vinfastPartsService.getFifoUnitRows(sku, pageNum, limitNum);
  }

  @Sse('sync/progress')
  progress(): Observable<MessageEvent> {
    const keepAlive$ = new Observable<MessageEvent>((subscriber) => {
      // Emit initial event to establish connection
      subscriber.next({
        data: JSON.stringify({
          message: 'Connected',
          processId: 'ping',
          current: 0,
          total: 0,
          completed: false,
        }),
      } as MessageEvent);

      const intervalId = setInterval(() => {
        subscriber.next({
          data: JSON.stringify({
            message: 'Ping',
            processId: 'ping',
            current: 0,
            total: 0,
            completed: false,
          }),
        } as MessageEvent);
      }, 15000);

      const subscription = this.vinfastPartsService.progress$.subscribe({
        next: (data) =>
          subscriber.next({ data: JSON.stringify(data) } as MessageEvent),
        error: (err) => subscriber.error(err),
        complete: () => subscriber.complete(),
      });

      return () => {
        clearInterval(intervalId);
        subscription.unsubscribe();
      };
    });

    return keepAlive$;
  }

  @Post('stock/export/excel/background')
  @ApiOperation({
    summary: 'Start background export for VinFast parts stock (FIFO)',
  })
  startVinfastPartsStockExportBackground(
    @Body() query: any,
    @Request() req: any,
  ) {
    return this.exportService.startBackgroundExport(
      query,
      req.user?.sub,
      (onProgress) => {
        return this.vinfastPartsService.exportStockExcel({
          vehicleType: query.vehicleType,
          dateFrom: query.dateFrom,
          dateTo: query.dateTo,
          columnFilters: query.columnFilters,
          onProgress,
        });
      },
    );
  }

  @Get('stock/export/excel/background/history')
  @ApiOperation({
    summary: 'Get history of background export for VinFast parts stock',
  })
  getVinfastPartsStockExportBackgroundHistory(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.exportService.listHistoryForUser(
      req.user?.sub,
      page ? Number(page) : undefined,
      pageSize ? Number(pageSize) : undefined,
    );
  }

  @Get('stock/export/excel/background/:jobId/download')
  @ApiOperation({
    summary: 'Download completed background export for VinFast parts stock',
  })
  async downloadVinfastPartsStockBackgroundExport(
    @Param('jobId') jobId: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    const { buffer, fileName } = this.exportService.getReadyExportFile(
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

  @Sse('stock/export/excel/progress/stream')
  @ApiOperation({
    summary: 'Stream progress of background export for VinFast parts stock',
  })
  vinfastPartsStockExportProgressStream(
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

      const snapshot = this.exportService.getJobSnapshotForUser(req.user?.sub);
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

      const subscription = this.exportService.progress$.subscribe({
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
}
