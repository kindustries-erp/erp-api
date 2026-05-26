import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { DirectusAuthGuard } from '../auth/guards/directus-auth.guard';
import { UserToken } from '../common/decorators/user-token.decorator';
import { ErpManufacturingService } from './erp-manufacturing.service';
import {
  ActivateErpWarrantyDto,
  CreateErpIssueDto,
  CreateErpItemDto,
  CreateErpPoDto,
  CreateErpReceiptDto,
  CreateErpVehicleDto,
  ErpMfgQueryDto,
  UpdateErpItemDto,
  UpdateErpPoDto,
  UpdateErpVehicleDto,
} from './dto/erp-manufacturing.dto';

@ApiTags('ERP Manufacturing')
@ApiBearerAuth()
@UseGuards(DirectusAuthGuard)
@Controller('erp-manufacturing')
export class ErpManufacturingController {
  constructor(private readonly service: ErpManufacturingService) {}

  // ─── Items ────────────────────────────────────────────────────────────────
  @Get('items')
  listItems(@Query() query: ErpMfgQueryDto, @UserToken() token: string) {
    return this.service.listItems(query, token);
  }

  @Post('items')
  createItem(@Body() dto: CreateErpItemDto, @UserToken() token: string) {
    return this.service.createItem(dto, token);
  }

  @Get('items/:id')
  getItem(@Param('id') id: string, @UserToken() token: string) {
    return this.service.getItem(id, token);
  }

  @Patch('items/:id')
  updateItem(
    @Param('id') id: string,
    @Body() dto: UpdateErpItemDto,
    @UserToken() token: string,
  ) {
    return this.service.updateItem(id, dto, token);
  }

  @Get('items/:id/stock-summary')
  stockSummary(@Param('id') id: string, @UserToken() token: string) {
    return this.service.getStockSummary(id, token);
  }

  // ─── PO Template & Import (must be before /:id routes) ───────────────────
  @Get('purchase-orders/template/download')
  downloadPoTemplate(@Res() res: any) {
    const buffer = this.service.generatePoTemplate();
    const filename = 'erp-po-import-template.xlsx';
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Post('purchase-orders/import')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async importPoExcel(
    @UploadedFile() file: { buffer: Buffer; originalname: string } | undefined,
    @UserToken() token: string,
  ) {
    if (!file) {
      throw new BadRequestException('Không tìm thấy file Excel upload');
    }
    return this.service.importPoFromExcel(file.buffer, token);
  }

  // ─── PO CRUD ──────────────────────────────────────────────────────────────
  @Get('purchase-orders')
  listPos(@Query() query: ErpMfgQueryDto, @UserToken() token: string) {
    return this.service.listPos(query, token);
  }

  @Post('purchase-orders')
  createPo(@Body() dto: CreateErpPoDto, @UserToken() token: string) {
    return this.service.createPo(dto, token);
  }

  @Get('purchase-orders/:id')
  getPo(@Param('id') id: string, @UserToken() token: string) {
    return this.service.getPo(id, token);
  }

  @Patch('purchase-orders/:id')
  updatePo(
    @Param('id') id: string,
    @Body() dto: UpdateErpPoDto,
    @UserToken() token: string,
  ) {
    return this.service.updatePo(id, dto, token);
  }

  @Post('purchase-orders/:id/confirm')
  confirmPo(@Param('id') id: string, @UserToken() token: string) {
    return this.service.confirmPo(id, token);
  }

  @Post('purchase-orders/:id/cancel')
  cancelPo(@Param('id') id: string, @UserToken() token: string) {
    return this.service.cancelPo(id, token);
  }

  // ─── Receipts ──────────────────────────────────────────────────────────────
  @Get('purchase-orders/:id/receipts')
  listReceipts(
    @Param('id') id: string,
    @Query() query: ErpMfgQueryDto,
    @UserToken() token: string,
  ) {
    return this.service.listReceipts(id, query, token);
  }

  @Post('purchase-orders/:id/receipts')
  createReceipt(
    @Param('id') id: string,
    @Body() dto: CreateErpReceiptDto,
    @UserToken() token: string,
  ) {
    return this.service.createReceipt(id, dto, token);
  }

  // ─── Vehicles ──────────────────────────────────────────────────────────────
  @Get('vehicles')
  listVehicles(@Query() query: ErpMfgQueryDto, @UserToken() token: string) {
    return this.service.listVehicles(query, token);
  }

  @Post('vehicles')
  createVehicle(@Body() dto: CreateErpVehicleDto, @UserToken() token: string) {
    return this.service.createVehicle(dto, token);
  }

  @Get('vehicles/:id')
  getVehicle(@Param('id') id: string, @UserToken() token: string) {
    return this.service.getVehicle(id, token);
  }

  @Patch('vehicles/:id')
  updateVehicle(
    @Param('id') id: string,
    @Body() dto: UpdateErpVehicleDto,
    @UserToken() token: string,
  ) {
    return this.service.updateVehicle(id, dto, token);
  }

  // ─── Issues ────────────────────────────────────────────────────────────────
  @Get('vehicles/:id/issues')
  listIssues(@Param('id') id: string, @UserToken() token: string) {
    return this.service.listIssues(id, token);
  }

  @Post('vehicles/:id/issues')
  createIssue(
    @Param('id') id: string,
    @Body() dto: CreateErpIssueDto,
    @UserToken() token: string,
  ) {
    return this.service.createIssue(id, dto, token);
  }

  // ─── Warranties ────────────────────────────────────────────────────────────
  @Get('vehicles/:id/warranties')
  listWarranties(@Param('id') id: string, @UserToken() token: string) {
    return this.service.listWarranties(id, token);
  }

  @Post('vehicles/:id/warranties/activate')
  activateWarranty(
    @Param('id') id: string,
    @Body() dto: ActivateErpWarrantyDto,
    @UserToken() token: string,
  ) {
    return this.service.activateWarranty(id, dto, token);
  }
}
