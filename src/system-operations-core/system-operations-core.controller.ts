import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Sse,
  UseGuards,
  MessageEvent,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../auth/guards/core-rbac.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { ErpResource, ErpAction } from '@/rbac-core/enums';
import { SystemOperationsCoreService } from './system-operations-core.service';
import { QuerySystemOperationDto } from './dto/query-operation.dto';

@ApiTags('erp_system_operations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('system-operations')
export class SystemOperationsCoreController {
  constructor(private readonly service: SystemOperationsCoreService) {}

  @Get('active')
  async getActive(@Query() query: QuerySystemOperationDto) {
    const items = await this.service.getActiveOperations(query);
    return {
      isLocked: items.length > 0,
      total: items.length,
      items,
      primaryLock: items[0] || null,
    };
  }

  @Get('check-action')
  async checkAction(
    @Query('module') moduleName: string,
    @Query('action') actionName?: string,
    @Query('targetId') targetId?: string,
  ) {
    return this.service.checkActionBlocked(moduleName, actionName, targetId);
  }

  @Sse('stream')
  stream(): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      // Initial connection ping
      subscriber.next({
        data: JSON.stringify({
          event: 'PING',
          data: { message: 'Connected to System Operations Stream' },
        }),
      } as MessageEvent);

      const intervalId = setInterval(() => {
        subscriber.next({
          data: JSON.stringify({
            event: 'PING',
            data: { timestamp: new Date().toISOString() },
          }),
        } as MessageEvent);
      }, 15000); // 15s keep-alive

      const subscription = this.service.stream$.subscribe({
        next: (event) =>
          subscriber.next({ data: JSON.stringify(event) } as MessageEvent),
        error: (err) => subscriber.error(err),
        complete: () => subscriber.complete(),
      });

      return () => {
        clearInterval(intervalId);
        subscription.unsubscribe();
      };
    });
  }

  @RequirePermissions({
    resource: ErpResource.SUPER_ADMIN,
    action: ErpAction.ALL,
  })
  @Post('admin/release/:id')
  async releaseLock(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body('reason') reason?: string,
  ) {
    const res = await this.service.completeOperation(id, {
      adminReleased: true,
      reason,
    });
    return {
      message: 'Đã giải phóng khóa hệ thống',
      data: res,
    };
  }
}
