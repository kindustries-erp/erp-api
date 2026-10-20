import {
  Body,
  Controller,
  MessageEvent,
  Post,
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
    // Chạy nền để SSE client nhận tiến độ qua progress$
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

  @Sse('sync/progress')
  @RequirePermissions({ resource: ErpResource.VINFAST, action: ErpAction.READ })
  progress(): Observable<MessageEvent> {
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
