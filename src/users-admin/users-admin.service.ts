import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Request } from 'express';
import { CoreUser } from '../users/entities/core-user.entity';
import { ErpEmployee } from '../employees-core/entities/erp_employee.entity';
import { CreateUserDto } from '@/v2/modules/users-management/dto/create-user.dto';
import { LinkEmployeeDto as LinkEmployeeV2Dto } from '@/v2/modules/users-management/dto/link-employee.dto';
import { ResetPasswordDto } from '@/v2/modules/users-management/dto/reset-password.dto';
import { UpdateUserDto } from '@/v2/modules/users-management/dto/update-user.dto';
import { buildAuditContext } from '@/v2/modules/users-management/helpers/audit-context';
import type { UserRequest } from '@/v2/modules/users-management/helpers/audit-context';
import { UsersAuthService } from '@/v2/modules/users-management/services/users-auth.service';
import { UsersManagementService } from '@/v2/modules/users-management/users-management.service';
import { AuditCoreService } from '../audit-core/audit-core.service';
import { UsersAdminQueryService } from './users-admin-query.service';
import { toSafeUser } from './helpers/users-admin.mapper';
import {
  ChangePasswordSelfDto,
  CreateUserAdminDto,
  LinkEmployeeDto,
  ListUsersAdminDto,
  ResetPasswordAdminDto,
  UpdateUserAdminDto,
} from './dto/user-admin.dto';

type AdminRequest = Request & { user?: { sub?: string; email?: string } };

@Injectable()
export class UsersAdminService {
  constructor(
    @InjectRepository(CoreUser)
    private readonly usersRepository: Repository<CoreUser>,
    @InjectRepository(ErpEmployee)
    private readonly employeesRepository: Repository<ErpEmployee>,
    private readonly query: UsersAdminQueryService,
    private readonly usersManagement: UsersManagementService,
    private readonly usersAuth: UsersAuthService,
    private readonly auditCoreService: AuditCoreService,
  ) {}

  private async getEmployeeOrNull(employeeId?: string | null) {
    if (!employeeId) return null;
    const employee = await this.employeesRepository.findOne({
      where: { id: employeeId },
    });
    if (!employee) {
      throw new NotFoundException('Không tìm thấy employee');
    }
    return employee;
  }

  private async writeAudit(
    request: AdminRequest,
    input: {
      actionType: string;
      entityType?: string | null;
      entityId?: string | null;
      status?: 'SUCCESS' | 'FAIL';
      message?: string | null;
      beforeSnapshot?: Record<string, unknown> | null;
      afterSnapshot?: Record<string, unknown> | null;
      errorSnapshot?: Record<string, unknown> | null;
    },
  ) {
    await this.auditCoreService.recordAction({
      actorUserId: request.user?.sub ?? null,
      actorEmail: request.user?.email ?? null,
      actionType: input.actionType,
      module: 'users',
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      route: request.originalUrl,
      httpMethod: request.method,
      status: input.status ?? 'SUCCESS',
      message: input.message ?? null,
      uiScreen: (request.headers['x-ui-screen'] as string) ?? null,
      uiAction: (request.headers['x-ui-action'] as string) ?? null,
      beforeSnapshot: input.beforeSnapshot ?? null,
      afterSnapshot: input.afterSnapshot ?? null,
      errorSnapshot: input.errorSnapshot ?? null,
      ipAddress: request.ip ?? null,
      userAgent: request.headers['user-agent'] ?? null,
      requestId: (request.headers['x-request-id'] as string) ?? null,
    });
  }

  /** Ghi qua service v2 (`users_management` là nguồn, `core_users` là bản sao cùng transaction), đọc lại từ bản sao. */
  private async readSafe(id: string) {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Không tìm thấy user');
    return toSafeUser(user, await this.getEmployeeOrNull(user.employeeId));
  }

  async createUser(dto: CreateUserAdminDto, request: AdminRequest) {
    const { data } = await this.usersManagement.create(
      Object.assign(new CreateUserDto(), {
        email: dto.email,
        password: dto.password,
        employeeId: dto.employeeId,
      }),
      buildAuditContext(request as UserRequest),
    );
    return {
      message: 'Tạo user thành công',
      data: await this.readSafe(data.id),
    };
  }

  getColumnOptions(
    column: string,
    search?: string,
    page: number = 1,
    pageSize: number = 20,
    filtersStr?: string,
  ) {
    return this.query.getColumnOptions(
      column,
      search,
      page,
      pageSize,
      filtersStr,
    );
  }

  listUsers(query: ListUsersAdminDto) {
    return this.query.listUsers(query);
  }

  async getUser(id: string) {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Không tìm thấy user');
    const employee = await this.getEmployeeOrNull(user.employeeId);
    return { data: toSafeUser(user, employee) };
  }

  async updateUser(id: string, dto: UpdateUserAdminDto, request: AdminRequest) {
    await this.usersManagement.update(
      id,
      Object.assign(new UpdateUserDto(), {
        status: dto.status,
        employeeId: dto.employeeId,
      }),
      buildAuditContext(request as UserRequest),
    );
    return {
      message: 'Cập nhật user thành công',
      data: await this.readSafe(id),
    };
  }

  async activateUser(id: string, request: AdminRequest) {
    await this.usersManagement.activate(
      id,
      buildAuditContext(request as UserRequest),
    );
    return {
      message: 'Kích hoạt user thành công',
      data: await this.readSafe(id),
    };
  }

  async deactivateUser(id: string, request: AdminRequest) {
    await this.usersManagement.deactivate(
      id,
      buildAuditContext(request as UserRequest),
    );
    return { message: 'Ngưng user thành công', data: await this.readSafe(id) };
  }

  async resetPassword(
    id: string,
    dto: ResetPasswordAdminDto,
    request: AdminRequest,
  ) {
    await this.usersManagement.resetPassword(
      id,
      Object.assign(new ResetPasswordDto(), { newPassword: dto.newPassword }),
      buildAuditContext(request as UserRequest),
    );
    return { message: 'Reset password thành công' };
  }

  async changeSelfPassword(
    userId: string,
    dto: ChangePasswordSelfDto,
    request: AdminRequest,
  ) {
    const result = await this.usersAuth.changeOwnPassword(
      userId,
      dto.oldPassword,
      dto.newPassword,
    );
    if (result.status === 'NOT_FOUND') {
      throw new NotFoundException('Không tìm thấy user');
    }
    if (result.status === 'WRONG_PASSWORD') {
      await this.writeAudit(request, {
        actionType: 'CHANGE_PASSWORD',
        entityType: 'core_user',
        entityId: userId,
        status: 'FAIL',
        message: 'Sai mật khẩu cũ',
      });
      throw new UnauthorizedException('Mật khẩu cũ không đúng');
    }
    await this.writeAudit(request, {
      actionType: 'CHANGE_PASSWORD',
      entityType: 'core_user',
      entityId: userId,
    });
    return { message: 'Đổi mật khẩu thành công' };
  }

  async linkEmployee(id: string, dto: LinkEmployeeDto, request: AdminRequest) {
    await this.usersManagement.linkEmployee(
      id,
      Object.assign(new LinkEmployeeV2Dto(), { employeeId: dto.employeeId }),
      buildAuditContext(request as UserRequest),
    );
    return {
      message: 'Liên kết employee thành công',
      data: await this.readSafe(id),
    };
  }

  async unlinkEmployee(id: string, request: AdminRequest) {
    await this.usersManagement.unlinkEmployee(
      id,
      buildAuditContext(request as UserRequest),
    );
    return {
      message: 'Gỡ liên kết employee thành công',
      data: await this.readSafe(id),
    };
  }
}
