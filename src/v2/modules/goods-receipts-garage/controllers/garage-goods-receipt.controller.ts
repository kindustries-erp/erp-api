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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CoreRbacGuard } from '@/auth/guards/core-rbac.guard';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import { ErpAction, ErpResource } from '@/v2/core/rbac-core';
import { GarageGoodsReceiptsCoreService } from '../goods-receipts-garage-core.service';
import { CreateGarageGoodsReceiptDto } from '../dto/create-garage-goods-receipt.dto';
import { QueryGarageGoodsReceiptDto } from '../dto/query-garage-goods-receipt.dto';
import { UpdateGarageGoodsReceiptDto } from '../dto/update-garage-goods-receipt.dto';

@ApiTags('garage-goods-receipts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('garage-goods-receipts')
export class GarageGoodsReceiptController {
  constructor(private readonly service: GarageGoodsReceiptsCoreService) {}

  @RequirePermissions({
    resource: ErpResource.GARAGE_GOODS_RECEIPTS,
    action: ErpAction.READ,
  })
  @ApiOperation({
    summary: 'Danh sách GarageGoodsReceipt (phân trang, tìm kiếm)',
  })
  @Get()
  findAll(@Query() query: QueryGarageGoodsReceiptDto) {
    return this.service.findAll(query);
  }

  // Đặt trước `:id` để `column-options` không bị hiểu thành id
  @RequirePermissions({
    resource: ErpResource.GARAGE_GOODS_RECEIPTS,
    action: ErpAction.READ,
  })
  @ApiOperation({
    summary: 'Gợi ý giá trị của một cột, áp dụng bộ lọc các cột khác',
  })
  @Get('column-options')
  columnOptions(
    @Query('column') column: string,
    @Query('search') search?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('filters') filters?: string,
  ) {
    return this.service.findColumnOptions(
      column,
      search,
      Math.max(1, parseInt(page, 10) || 1),
      Math.max(1, Math.min(200, parseInt(pageSize, 10) || 20)),
      filters,
    );
  }

  @RequirePermissions({
    resource: ErpResource.GARAGE_GOODS_RECEIPTS,
    action: ErpAction.READ,
  })
  @ApiOperation({ summary: 'Sinh mã phiếu nhập kho tiếp theo' })
  @Get('next-code')
  getNextCode(@Query('date') date?: string) {
    return this.service.getNextCode(date);
  }

  @RequirePermissions({
    resource: ErpResource.GARAGE_GOODS_RECEIPTS,
    action: ErpAction.READ,
  })
  @ApiOperation({ summary: 'Chi tiết GarageGoodsReceipt' })
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @RequirePermissions({
    resource: ErpResource.GARAGE_GOODS_RECEIPTS,
    action: ErpAction.CREATE,
  })
  @ApiOperation({ summary: 'Tạo mới GarageGoodsReceipt' })
  @Post()
  create(@Body() dto: CreateGarageGoodsReceiptDto) {
    return this.service.create(dto);
  }

  @RequirePermissions({
    resource: ErpResource.GARAGE_GOODS_RECEIPTS,
    action: ErpAction.UPDATE,
  })
  @ApiOperation({ summary: 'Cập nhật GarageGoodsReceipt' })
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGarageGoodsReceiptDto,
  ) {
    return this.service.update(id, dto);
  }

  @RequirePermissions({
    resource: ErpResource.GARAGE_GOODS_RECEIPTS,
    action: ErpAction.UPDATE,
  })
  @ApiOperation({ summary: 'Ghi sổ nhập kho và tăng tồn kho' })
  @Post(':id/post')
  postReceipt(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.post(id);
  }

  @RequirePermissions({
    resource: ErpResource.GARAGE_GOODS_RECEIPTS,
    action: ErpAction.UPDATE,
  })
  @ApiOperation({ summary: 'Hủy phiếu nhập kho' })
  @Post(':id/cancel')
  cancelReceipt(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.cancel(id);
  }

  @RequirePermissions({
    resource: ErpResource.GARAGE_GOODS_RECEIPTS,
    action: ErpAction.DELETE,
  })
  @ApiOperation({ summary: 'Xóa mềm GarageGoodsReceipt' })
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
