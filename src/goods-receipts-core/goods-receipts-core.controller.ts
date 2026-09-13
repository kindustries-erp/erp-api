import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  Res,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Observable } from 'rxjs';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../auth/guards/core-rbac.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { ErpResource, ErpAction } from '@/rbac-core/enums';
import { PaginationDto } from '../common/dto/pagination.dto';
import { GoodsReceiptsCoreService } from './goods-receipts-core.service';
import { CreateGoodsReceiptDto } from './dto/create-goods-receipt.dto';
import { UpdateGoodsReceiptDto } from './dto/update-goods-receipt.dto';
import { PostGoodsReceiptDto } from './dto/post-goods-receipt.dto';
import { GoodsReceiptsCronService } from './goods-receipts-cron.service';

@ApiTags('erp_goods_receipts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('goods-receipts')
export class GoodsReceiptsCoreController {
  constructor(
    private readonly service: GoodsReceiptsCoreService,
    private readonly cronService: GoodsReceiptsCronService,
  ) {}

  @RequirePermissions({
    resource: ErpResource.GOODS_RECEIPTS,
    action: ErpAction.CREATE,
  })
  @Post()
  create(@Body() dto: CreateGoodsReceiptDto) {
    return this.service.create(dto);
  }

  @RequirePermissions({
    resource: ErpResource.GOODS_RECEIPTS,
    action: ErpAction.READ,
  })
  @Get()
  findAll(@Query() query: PaginationDto) {
    return this.service.findAll(query);
  }

  @Get('next-no')
  getNextNo(@Query('date') date?: string) {
    return this.service.getNextReceiptNo(date);
  }

  @Post('validate-serials')
  validateSerials(@Body() dto: { itemId?: string; serials: string[] }) {
    return this.service.validateSerials(dto);
  }

  @Post('auto-generate-preview')
  autoGeneratePreview(
    @Body() dto: { itemId: string; qty: number; receiptDate?: string },
  ) {
    return this.service.generatePreviewSerials(dto);
  }

  @Get('serial-generation/progress')
  getSerialGenerationProgress() {
    return this.cronService.getProgress();
  }

  @Sse('serial-generation/progress/stream')
  serialGenerationProgressStream(): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      // Emit initial connection event to force 200 OK and establish connection
      subscriber.next({
        data: JSON.stringify({
          processId: 'ping',
          pendingLines: 0,
          pendingSerials: 0,
          isRunning: false,
          completed: false,
          message: 'Connected',
        }),
      } as MessageEvent);

      const intervalId = setInterval(() => {
        subscriber.next({
          data: JSON.stringify({
            processId: 'ping',
            pendingLines: 0,
            pendingSerials: 0,
            isRunning: false,
            completed: false,
            message: 'Ping',
          }),
        } as MessageEvent);
      }, 15000); // 15s keep-alive

      const subscription = this.cronService.progress$.subscribe({
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
  }

  @RequirePermissions({
    resource: ErpResource.GOODS_RECEIPTS,
    action: ErpAction.READ,
  })
  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.findOne(id);
  }

  @RequirePermissions({
    resource: ErpResource.GOODS_RECEIPTS,
    action: ErpAction.READ,
  })
  @Get(':id/export-xlsx')
  async exportXlsx(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res() res: Response,
  ) {
    const buffer = await this.service.exportXlsx(id);
    const receiptRes = await this.service.findOne(id);
    const receiptNo = receiptRes.data.receiptNo || 'draft';
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="PhieuNhapKho_${receiptNo}.xlsx"`,
    );
    res.send(buffer);
  }

  @RequirePermissions({
    resource: ErpResource.GOODS_RECEIPTS,
    action: ErpAction.UPDATE,
  })
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateGoodsReceiptDto,
  ) {
    return this.service.update(id, dto);
  }

  @Post(':id/post')
  postReceipt(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: PostGoodsReceiptDto,
  ) {
    return this.service.postReceipt(id, dto);
  }

  @Post(':id/cancel')
  cancelReceipt(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.cancelReceipt(id);
  }

  @RequirePermissions({
    resource: ErpResource.GOODS_RECEIPTS,
    action: ErpAction.DELETE,
  })
  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.remove(id);
  }
}
