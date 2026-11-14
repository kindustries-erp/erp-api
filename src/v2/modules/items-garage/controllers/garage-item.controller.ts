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
import { ItemsGarageService } from '../items-garage.service';
import { CreateGarageItemDto } from '../dto/create-garage-item.dto';
import { QueryGarageItemDto } from '../dto/query-garage-item.dto';
import { UpdateGarageItemDto } from '../dto/update-garage-item.dto';

@ApiTags('items-garage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('api/v2/items-garage')
export class GarageItemController {
  constructor(private readonly service: ItemsGarageService) {}

  @RequirePermissions({
    resource: ErpResource.GARAGE_ITEMS,
    action: ErpAction.READ,
  })
  @ApiOperation({ summary: 'Danh sách GarageItem (phân trang, tìm kiếm)' })
  @Get()
  findAll(@Query() query: QueryGarageItemDto) {
    return this.service.findAll(query);
  }

  // Đặt trước `:id` để `column-options` không bị hiểu thành id
  @RequirePermissions({
    resource: ErpResource.GARAGE_ITEMS,
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
    resource: ErpResource.GARAGE_ITEMS,
    action: ErpAction.READ,
  })
  @ApiOperation({ summary: 'Chi tiết GarageItem' })
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @RequirePermissions({
    resource: ErpResource.GARAGE_ITEMS,
    action: ErpAction.CREATE,
  })
  @ApiOperation({ summary: 'Tạo mới GarageItem' })
  @Post()
  create(@Body() dto: CreateGarageItemDto) {
    return this.service.create(dto);
  }

  @RequirePermissions({
    resource: ErpResource.GARAGE_ITEMS,
    action: ErpAction.UPDATE,
  })
  @ApiOperation({ summary: 'Cập nhật GarageItem' })
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGarageItemDto,
  ) {
    return this.service.update(id, dto);
  }

  @RequirePermissions({
    resource: ErpResource.GARAGE_ITEMS,
    action: ErpAction.DELETE,
  })
  @ApiOperation({ summary: 'Xóa mềm GarageItem' })
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
