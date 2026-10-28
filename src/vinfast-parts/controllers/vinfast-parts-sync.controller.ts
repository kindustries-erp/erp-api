import {
  Body,
  ConflictException,
  Controller,
  Get,
  MessageEvent,
  Post,
  Res,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../../auth/guards/core-rbac.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { ErpAction, ErpResource } from '@/rbac-core/enums';
import { VinfastPartsService } from '../vinfast-parts.service';
import {
  applySseHeaders,
  SSE_PING_INTERVAL_MS,
} from '../helpers/sse-headers.helper';
import type { Response } from 'express';

@ApiTags('VinFast Parts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('vinfast-parts')
export class VinfastPartsSyncController {
  constructor(private readonly vinfastPartsService: VinfastPartsService) {}

  @Post('sync-catalog')
  @RequirePermissions({
    resource: ErpResource.VINFAST,
    action: ErpAction.UPDATE,
  })
  @ApiOperation({ summary: 'Sync VinFast parts catalog from invoice history' })
  async syncCatalog() {
    return this.vinfastPartsService.syncCatalog();
  }

  @Post('sync-ledger')
  @RequirePermissions({
    resource: ErpResource.VINFAST,
    action: ErpAction.UPDATE,
  })
  @ApiOperation({ summary: 'Sync VinFast parts ledger from invoice history' })
  async syncLedger(
    @Body() body: { dateFrom?: string; dateTo?: string; clearDb?: boolean },
  ) {
    const { started, state } = this.vinfastPartsService.runFullSync({
      dateFrom: body.dateFrom,
      dateTo: body.dateTo,
      clearDb: body.clearDb,
    });
    if (!started) {
      throw new ConflictException({
        message: 'Đang có lượt đồng bộ chạy, vui lòng chờ hoàn tất',
        state,
      });
    }
    return { message: 'Sync started', state };
  }

  @Get('sync/status')
  @RequirePermissions({ resource: ErpResource.VINFAST, action: ErpAction.READ })
  @ApiOperation({
    summary: 'Get state of the current or last VinFast sync run',
  })
  getSyncStatus() {
    return this.vinfastPartsService.getSyncState();
  }

  @Sse('sync/progress')
  @RequirePermissions({ resource: ErpResource.VINFAST, action: ErpAction.READ })
  progress(
    @Res({ passthrough: true }) res: Response,
  ): Observable<MessageEvent> {
    applySseHeaders(res);
    const keepAlive$ = new Observable<MessageEvent>((subscriber) => {
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
      }, SSE_PING_INTERVAL_MS);

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
