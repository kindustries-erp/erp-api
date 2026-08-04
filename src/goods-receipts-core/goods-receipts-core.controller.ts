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
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../auth/guards/core-rbac.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
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

  @RequirePermissions({ resource: 'goods_receipts', action: 'create' })
  @Post()
  create(@Body() dto: CreateGoodsReceiptDto) {
    return this.service.create(dto);
  }

  @RequirePermissions({ resource: 'goods_receipts', action: 'read' })
  @Get()
  findAll(@Query() query: PaginationDto) {
    return this.service.findAll(query);
  }

  @Get('next-no')
  getNextNo(@Query('date') date?: string) {
    return this.service.getNextReceiptNo(date);
  }

  @Get('serial-generation/progress')
  getSerialGenerationProgress() {
    return this.cronService.getProgress();
  }

  @RequirePermissions({ resource: 'goods_receipts', action: 'read' })
  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.findOne(id);
  }

  @RequirePermissions({ resource: 'goods_receipts', action: 'read' })
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

  @RequirePermissions({ resource: 'goods_receipts', action: 'update' })
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

  @RequirePermissions({ resource: 'goods_receipts', action: 'delete' })
  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.remove(id);
  }
}
