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
import { ErpAction } from '@/rbac-core/enums/erp-action.enum';
import { ErpResource } from '@/rbac-core/enums/erp-resource.enum';
import { BusinessPartnersCoreService } from '../business-partners-core.service';
import { CreateErpBusinessPartnerDto } from '../dto/create-erp-business-partner.dto';
import { QueryErpBusinessPartnerDto } from '../dto/query-erp-business-partner.dto';
import { UpdateErpBusinessPartnerDto } from '../dto/update-erp-business-partner.dto';

@ApiTags('business-partners')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('business-partners')
export class ErpBusinessPartnerController {
  constructor(private readonly service: BusinessPartnersCoreService) {}

  @RequirePermissions({
    resource: ErpResource.BUSINESS_PARTNERS,
    action: ErpAction.READ,
  })
  @ApiOperation({
    summary: 'Danh sách ErpBusinessPartner (phân trang, tìm kiếm)',
  })
  @Get()
  findAll(@Query() query: QueryErpBusinessPartnerDto) {
    return this.service.findAll(query);
  }

  // Đặt trước `:id` để `column-options` không bị hiểu thành id
  @RequirePermissions({
    resource: ErpResource.BUSINESS_PARTNERS,
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
    @Query('partnerType') partnerType?: string,
  ) {
    return this.service.findColumnOptions(
      column,
      search,
      Math.max(1, parseInt(page, 10) || 1),
      Math.max(1, Math.min(200, parseInt(pageSize, 10) || 20)),
      filters,
      partnerType,
    );
  }

  @RequirePermissions({
    resource: ErpResource.BUSINESS_PARTNERS,
    action: ErpAction.READ,
  })
  @ApiOperation({ summary: 'Mã đối tác kế tiếp theo loại (NCC-, KH-, DT-)' })
  @Get('next-code')
  getNextCode(@Query('partnerType') partnerType?: string) {
    return this.service.getNextCode(partnerType);
  }

  @RequirePermissions({
    resource: ErpResource.BUSINESS_PARTNERS,
    action: ErpAction.READ,
  })
  @ApiOperation({ summary: 'Chi tiết ErpBusinessPartner' })
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @RequirePermissions({
    resource: ErpResource.BUSINESS_PARTNERS,
    action: ErpAction.CREATE,
  })
  @ApiOperation({ summary: 'Tạo mới ErpBusinessPartner' })
  @Post()
  create(@Body() dto: CreateErpBusinessPartnerDto) {
    return this.service.create(dto);
  }

  @RequirePermissions({
    resource: ErpResource.BUSINESS_PARTNERS,
    action: ErpAction.UPDATE,
  })
  @ApiOperation({ summary: 'Cập nhật ErpBusinessPartner' })
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateErpBusinessPartnerDto,
  ) {
    return this.service.update(id, dto);
  }

  @RequirePermissions({
    resource: ErpResource.BUSINESS_PARTNERS,
    action: ErpAction.DELETE,
  })
  @ApiOperation({ summary: 'Xóa mềm ErpBusinessPartner' })
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
