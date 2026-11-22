import { Injectable, NotFoundException } from '@nestjs/common';
import { toPaginatedResult } from '@/common/utils/paginated-result';
import { ColumnOptionsQueryDto } from './dto/column-options-query.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { LinkEmployeeDto } from './dto/link-employee.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import type { UserAuditContext } from './helpers/audit-context';
import { toUserResponse } from './helpers/user.mapper';
import { UsersManagementCommandService } from './services/users-management-command.service';
import { UsersManagementQueryService } from './services/users-management-query.service';

/** Facade của module: điều phối query/command, luôn trả response DTO, không lộ entity hay mật khẩu. */
@Injectable()
export class UsersManagementService {
  constructor(
    private readonly query: UsersManagementQueryService,
    private readonly command: UsersManagementCommandService,
  ) {}

  async findAll(dto: QueryUserDto, viewerEmail?: string | null) {
    const page = await this.query.findAll(dto, viewerEmail);
    const employees = await this.query.findEmployeeMap(
      page.items.map((item) => item.employeeId),
    );
    return toPaginatedResult(
      page.items.map((item) =>
        toUserResponse(
          item,
          item.employeeId ? employees.get(item.employeeId) : null,
        ),
      ),
      page.page,
      page.pageSize,
      page.total,
      page.summaries,
    );
  }

  findColumnOptions(dto: ColumnOptionsQueryDto, viewerEmail?: string | null) {
    return this.query.findColumnOptions(dto, viewerEmail);
  }

  async findOne(id: string, viewerEmail?: string | null) {
    const entity = await this.query.findVisibleById(id, viewerEmail);
    if (!entity) throw new NotFoundException('Không tìm thấy tài khoản');
    const employees = await this.query.findEmployeeMap([entity.employeeId]);
    return {
      message: 'Lấy thông tin thành công',
      data: toUserResponse(
        entity,
        entity.employeeId ? employees.get(entity.employeeId) : null,
      ),
    };
  }

  async create(dto: CreateUserDto, ctx: UserAuditContext) {
    return {
      message: 'Tạo tài khoản thành công',
      data: await this.command.create(dto, ctx),
    };
  }

  async update(id: string, dto: UpdateUserDto, ctx: UserAuditContext) {
    await this.assertVisible(id, ctx.actorEmail);
    return {
      message: 'Cập nhật tài khoản thành công',
      data: await this.command.update(id, dto, ctx),
    };
  }

  async activate(id: string, ctx: UserAuditContext) {
    await this.assertVisible(id, ctx.actorEmail);
    return {
      message: 'Kích hoạt tài khoản thành công',
      data: await this.command.activate(id, ctx),
    };
  }

  async deactivate(id: string, ctx: UserAuditContext) {
    await this.assertVisible(id, ctx.actorEmail);
    return {
      message: 'Vô hiệu hóa tài khoản thành công',
      data: await this.command.deactivate(id, ctx),
    };
  }

  async resetPassword(
    id: string,
    dto: ResetPasswordDto,
    ctx: UserAuditContext,
  ) {
    await this.assertVisible(id, ctx.actorEmail);
    await this.command.resetPassword(id, dto, ctx);
    return { message: 'Đặt lại mật khẩu thành công' };
  }

  async linkEmployee(id: string, dto: LinkEmployeeDto, ctx: UserAuditContext) {
    await this.assertVisible(id, ctx.actorEmail);
    return {
      message: 'Liên kết nhân viên thành công',
      data: await this.command.linkEmployee(id, dto.employeeId, ctx),
    };
  }

  async unlinkEmployee(id: string, ctx: UserAuditContext) {
    await this.assertVisible(id, ctx.actorEmail);
    return {
      message: 'Gỡ liên kết nhân viên thành công',
      data: await this.command.unlinkEmployee(id, ctx),
    };
  }

  /** Tài khoản test với người không có quyền: trả 404 như thể không tồn tại. */
  private async assertVisible(id: string, viewerEmail?: string | null) {
    const entity = await this.query.findVisibleById(id, viewerEmail);
    if (!entity) throw new NotFoundException('Không tìm thấy tài khoản');
  }
}
