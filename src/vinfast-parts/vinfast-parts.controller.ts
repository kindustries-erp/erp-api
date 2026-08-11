import {
  Controller,
  Post,
  Body,
  Sse,
  MessageEvent,
  Get,
  Query,
  Param,
} from '@nestjs/common';
import { VinfastPartsService } from './vinfast-parts.service';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Observable } from 'rxjs';

@ApiTags('VinFast Parts')
@Controller('vinfast-parts')
export class VinfastPartsController {
  constructor(private readonly vinfastPartsService: VinfastPartsService) {}

  @Post('sync-catalog')
  @ApiOperation({ summary: 'Sync VinFast parts catalog from invoice history' })
  async syncCatalog() {
    return this.vinfastPartsService.syncCatalog();
  }

  @Post('sync-ledger')
  @ApiOperation({ summary: 'Sync VinFast parts ledger from invoice history' })
  async syncLedger(@Body() body: { dateFrom?: string; dateTo?: string }) {
    // We pass the service's own progress$ subject so SSE clients can listen to it
    // Run async to not block the request, or we can await it.
    // Let's run it async so the SSE connection can stream.
    this.vinfastPartsService
      .syncCatalog({
        progress$: this.vinfastPartsService.progress$,
        dateFrom: body.dateFrom,
        dateTo: body.dateTo,
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
    );
  }

  @Get('stock/column-options')
  @ApiOperation({
    summary: 'Get VinFast parts stock column options for filter',
  })
  async getStockColumnOptions(
    @Query('columnKey') columnKey: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('filters') filters?: string,
    @Query('vehicleType') vehicleType?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.vinfastPartsService.getStockColumnOptions(
      columnKey,
      search,
      pageNum,
      limitNum,
      filters,
      vehicleType,
    );
  }

  @Get('ledger/:sku')
  @ApiOperation({ summary: 'Get VinFast parts ledger history (FIFO trace)' })
  async getLedgerHistory(@Param('sku') sku: string) {
    return this.vinfastPartsService.getPartLedgerHistory(sku);
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
}
