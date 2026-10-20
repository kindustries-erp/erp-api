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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Observable } from 'rxjs';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../../auth/guards/core-rbac.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { ErpAction, ErpResource } from '@/rbac-core/enums';
import { VinfastPartsService } from '../vinfast-parts.service';
import { VinfastPartsStockExportBackgroundService } from '../services/vinfast-parts-stock-export-background.service';
import {
  applySseHeaders,
  SSE_PING_INTERVAL_MS,
} from '../helpers/sse-headers.helper';

@ApiTags('VinFast Parts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('vinfast-parts')
export class VinfastPartsStockExportController {
  constructor(
    private readonly vinfastPartsService: VinfastPartsService,
    private readonly exportService: VinfastPartsStockExportBackgroundService,
  ) {}

  @Post('stock/export/excel/background')
  @RequirePermissions({ resource: ErpResource.VINFAST, action: ErpAction.READ })
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
  @RequirePermissions({ resource: ErpResource.VINFAST, action: ErpAction.READ })
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
  @RequirePermissions({ resource: ErpResource.VINFAST, action: ErpAction.READ })
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
  @RequirePermissions({ resource: ErpResource.VINFAST, action: ErpAction.READ })
  @ApiOperation({
    summary: 'Stream progress of background export for VinFast parts stock',
  })
  vinfastPartsStockExportProgressStream(
    @Request() req: any,
    @Res({ passthrough: true }) res: Response,
  ): Observable<MessageEvent> {
    applySseHeaders(res);
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
      }, SSE_PING_INTERVAL_MS);

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
