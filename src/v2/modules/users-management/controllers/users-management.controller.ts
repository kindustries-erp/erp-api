import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CoreRbacGuard } from '@/auth/guards/core-rbac.guard';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import { ErpAction, ErpResource } from '@/v2/core/rbac-core';
import { ColumnOptionsQueryDto } from '../dto/column-options-query.dto';
import { CreateUserDto } from '../dto/create-user.dto';
import { LinkEmployeeDto } from '../dto/link-employee.dto';
import { QueryUserDto } from '../dto/query-user.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { buildAuditContext } from '../helpers/audit-context';
import type { UserRequest } from '../helpers/audit-context';
import { UsersManagementService } from '../users-management.service';

@ApiTags('users-management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@RequirePermissions({
  resource: ErpResource.ADMIN_USERS,
  action: ErpAction.MANAGE,
})
@Controller('api/v2/users-management')
export class UsersManagementController {
  constructor(private readonly service: UsersManagementService) {}

  @ApiOperation({ summary: 'Danh sách tài khoản (phân trang, lọc, sắp xếp)' })
  @Get()
  findAll(@Query() query: QueryUserDto, @Req() request: UserRequest) {
    return this.service.findAll(query, buildAuditContext(request).actorEmail);
  }

  // Đặt trước `:id` để `column-options` không bị hiểu thành id
  @ApiOperation({ summary: 'Gợi ý giá trị cột, áp dụng bộ lọc các cột khác' })
  @Get('column-options')
  columnOptions(
    @Query() query: ColumnOptionsQueryDto,
    @Req() request: UserRequest,
  ) {
    return this.service.findColumnOptions(
      query,
      buildAuditContext(request).actorEmail,
    );
  }

  @ApiOperation({ summary: 'Chi tiết tài khoản' })
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @Req() request: UserRequest) {
    return this.service.findOne(id, buildAuditContext(request).actorEmail);
  }

  @ApiOperation({ summary: 'Tạo tài khoản' })
  @Post()
  create(@Body() dto: CreateUserDto, @Req() request: UserRequest) {
    return this.service.create(dto, buildAuditContext(request));
  }

  @ApiOperation({ summary: 'Cập nhật trạng thái, liên kết nhân viên' })
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @Req() request: UserRequest,
  ) {
    return this.service.update(id, dto, buildAuditContext(request));
  }

  @ApiOperation({ summary: 'Kích hoạt tài khoản' })
  @Post(':id/activate')
  activate(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: UserRequest,
  ) {
    return this.service.activate(id, buildAuditContext(request));
  }

  @ApiOperation({ summary: 'Vô hiệu hóa tài khoản (không thể tự vô hiệu hóa)' })
  @Post(':id/deactivate')
  deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: UserRequest,
  ) {
    return this.service.deactivate(id, buildAuditContext(request));
  }

  @ApiOperation({ summary: 'Admin đặt lại mật khẩu, thu hồi phiên đăng nhập' })
  @Post(':id/reset-password')
  resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetPasswordDto,
    @Req() request: UserRequest,
  ) {
    return this.service.resetPassword(id, dto, buildAuditContext(request));
  }

  @ApiOperation({ summary: 'Liên kết tài khoản với nhân viên' })
  @Post(':id/link-employee')
  linkEmployee(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LinkEmployeeDto,
    @Req() request: UserRequest,
  ) {
    return this.service.linkEmployee(id, dto, buildAuditContext(request));
  }

  @ApiOperation({ summary: 'Gỡ liên kết nhân viên' })
  @Post(':id/unlink-employee')
  unlinkEmployee(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: UserRequest,
  ) {
    return this.service.unlinkEmployee(id, buildAuditContext(request));
  }
}
