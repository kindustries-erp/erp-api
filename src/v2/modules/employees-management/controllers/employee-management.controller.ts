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
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CoreRbacGuard } from '@/auth/guards/core-rbac.guard';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import { ErpAction, ErpResource } from '@/v2/core/rbac-core';
import { ColumnOptionsResponseDto } from '@/common/dto/column-options-response.dto';
import {
  CreateEmployeeManagementDto,
  EmployeeManagementListResponseDto,
  QueryEmployeeManagementDto,
  UpdateEmployeeManagementDto,
  UpdateEmployeeStatusDto,
} from '../dto';
import { EmployeesManagementService } from '../employees-management.service';

@ApiTags('employees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('api/v2/employees')
export class EmployeeManagementController {
  constructor(private readonly service: EmployeesManagementService) {}

  @RequirePermissions({
    resource: ErpResource.EMPLOYEES,
    action: ErpAction.READ,
  })
  @ApiOperation({ summary: 'Danh sách nhân viên (phân trang, lọc, tìm kiếm)' })
  @ApiOkResponse({ type: EmployeeManagementListResponseDto })
  @Get()
  findAll(@Query() query: QueryEmployeeManagementDto) {
    return this.service.findAll(query);
  }

  // Đặt trước `:id` để `column-options` và `next-code` không bị hiểu thành id
  @RequirePermissions({
    resource: ErpResource.EMPLOYEES,
    action: ErpAction.READ,
  })
  @ApiOperation({ summary: 'Gợi ý giá trị của một cột' })
  @ApiOkResponse({ type: ColumnOptionsResponseDto })
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
    resource: ErpResource.EMPLOYEES,
    action: ErpAction.READ,
  })
  @ApiOperation({ summary: 'Mã nhân viên kế tiếp (NV-001...)' })
  @Get('next-code')
  getNextCode() {
    return this.service.getNextCode();
  }

  @RequirePermissions({
    resource: ErpResource.EMPLOYEES,
    action: ErpAction.READ,
  })
  @ApiOperation({ summary: 'Chi tiết nhân viên (CCCD được che)' })
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  // CCCD đầy đủ là dữ liệu nhạy cảm: chỉ người có quyền cập nhật mới xem được
  @RequirePermissions({
    resource: ErpResource.EMPLOYEES,
    action: ErpAction.UPDATE,
  })
  @ApiOperation({ summary: 'CCCD đầy đủ của nhân viên (cần quyền cập nhật)' })
  @Get(':id/national-id')
  getNationalId(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getNationalId(id);
  }

  @RequirePermissions({
    resource: ErpResource.EMPLOYEES,
    action: ErpAction.CREATE,
  })
  @ApiOperation({ summary: 'Tạo nhân viên' })
  @Post()
  create(@Body() dto: CreateEmployeeManagementDto) {
    return this.service.create(dto);
  }

  @RequirePermissions({
    resource: ErpResource.EMPLOYEES,
    action: ErpAction.UPDATE,
  })
  @ApiOperation({ summary: 'Cập nhật nhân viên' })
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeManagementDto,
  ) {
    return this.service.update(id, dto);
  }

  @RequirePermissions({
    resource: ErpResource.EMPLOYEES,
    action: ErpAction.UPDATE,
  })
  @ApiOperation({ summary: 'Đổi trạng thái ACTIVE/INACTIVE' })
  @Post(':id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeStatusDto,
  ) {
    return this.service.updateStatus(id, dto);
  }

  @RequirePermissions({
    resource: ErpResource.EMPLOYEES,
    action: ErpAction.DELETE,
  })
  @ApiOperation({
    summary: 'Xóa mềm nhân viên (chặn khi còn liên kết tài khoản)',
  })
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
