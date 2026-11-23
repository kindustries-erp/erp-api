import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { EntityManager } from 'typeorm';
import { EmployeeManagement } from '@/v2/modules/employees-management/entities/employee-management.entity';
import {
  assertValidExtraData,
  mergeExtraData,
} from '@/v2/core/base-core/helpers/extra-data.util';
import {
  hashPassword,
  normalizeEmail,
  USER_STATUS_INACTIVE,
} from '@/v2/core/users-core';
import { CreateUserDto } from '../dto/create-user.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UserResponseDto } from '../dto/user-response.dto';
import { UsersManagement } from '../entities/users-management.entity';
import type { UserAuditContext } from '../helpers/audit-context';
import { toUserResponse } from '../helpers/user.mapper';
import {
  revokeAllUserSessions,
  syncToLegacyCoreUser,
} from './legacy-core-user.sync';
import { UsersAuditWriter, UserAuditAction } from './users-audit.writer';
import { UsersEmployeeLinkService } from './users-employee-link.service';

const PG_UNIQUE_VIOLATION = '23505';

type Change = (manager: EntityManager, user: UsersManagement) => Promise<void>;

/**
 * Ghi dữ liệu tài khoản. Mỗi thao tác chạy trong MỘT transaction: khóa hàng tài khoản,
 * áp dụng thay đổi, lưu, đồng bộ sang `core_users`; audit ghi đúng một lần sau khi commit.
 */
@Injectable()
export class UsersManagementCommandService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly links: UsersEmployeeLinkService,
    private readonly audit: UsersAuditWriter,
  ) {}

  async create(
    dto: CreateUserDto,
    ctx: UserAuditContext,
  ): Promise<UserResponseDto> {
    if (dto.extraData !== undefined) assertValidExtraData(dto.extraData);
    const email = normalizeEmail(dto.email);
    const passwordHash = await hashPassword(dto.password);

    const after = await this.run(async () =>
      this.dataSource.transaction(async (manager) => {
        const repo = manager.getRepository(UsersManagement);
        // Unique index tính cả dòng đã xóa mềm, nên kiểm trùng không lọc isDeleted
        if (await repo.exists({ where: { email } })) {
          throw new ConflictException('Email đã tồn tại');
        }
        const user = await repo.save(
          repo.create({
            email,
            passwordHash,
            status: 'ACTIVE',
            employeeId: null,
            lastLoginAt: null,
            createdBy: ctx.actorUserId,
            passwordChangedAt: null,
            isDeleted: false,
            extraData: dto.extraData ?? {},
          }),
        );
        if (dto.employeeId) {
          await this.links.apply(manager, user, dto.employeeId);
          await repo.save(user);
        }
        await syncToLegacyCoreUser(manager, user);
        return toUserResponse(
          user,
          await this.loadEmployee(manager, user.employeeId),
        );
      }),
    );

    await this.audit.write(ctx, {
      actionType: 'CREATE_USER',
      entityId: after.id,
      afterSnapshot: { ...after },
    });
    return after;
  }

  update(id: string, dto: UpdateUserDto, ctx: UserAuditContext) {
    if (dto.extraData !== undefined) assertValidExtraData(dto.extraData);
    return this.mutate(id, ctx, 'UPDATE_USER', (manager, user) =>
      this.applyUpdate(manager, user, dto, ctx),
    );
  }

  activate(id: string, ctx: UserAuditContext) {
    return this.mutate(id, ctx, 'ACTIVATE_USER', (manager, user) =>
      this.applyUpdate(manager, user, { status: 'ACTIVE' }, ctx),
    );
  }

  deactivate(id: string, ctx: UserAuditContext) {
    return this.mutate(id, ctx, 'DEACTIVATE_USER', (manager, user) =>
      this.applyUpdate(manager, user, { status: USER_STATUS_INACTIVE }, ctx),
    );
  }

  linkEmployee(id: string, employeeId: string, ctx: UserAuditContext) {
    return this.mutate(id, ctx, 'LINK_EMPLOYEE', (manager, user) =>
      this.applyUpdate(manager, user, { employeeId }, ctx),
    );
  }

  unlinkEmployee(id: string, ctx: UserAuditContext) {
    return this.mutate(id, ctx, 'UNLINK_EMPLOYEE', (manager, user) =>
      this.applyUpdate(manager, user, { employeeId: null }, ctx),
    );
  }

  async resetPassword(
    id: string,
    dto: ResetPasswordDto,
    ctx: UserAuditContext,
  ): Promise<void> {
    const passwordHash = await hashPassword(dto.newPassword);
    await this.mutate(
      id,
      ctx,
      'RESET_PASSWORD',
      async (manager, user) => {
        user.passwordHash = passwordHash;
        user.passwordChangedAt = new Date();
        await revokeAllUserSessions(manager, user.id);
      },
      'Admin reset password',
    );
  }

  private async applyUpdate(
    manager: EntityManager,
    user: UsersManagement,
    dto: UpdateUserDto,
    ctx: UserAuditContext,
  ): Promise<void> {
    if (dto.status !== undefined && dto.status !== user.status) {
      if (dto.status === USER_STATUS_INACTIVE) {
        if (ctx.actorUserId === user.id) {
          throw new BadRequestException(
            'Không thể tự vô hiệu hóa tài khoản của chính mình',
          );
        }
        await revokeAllUserSessions(manager, user.id);
      }
      user.status = dto.status;
    }
    if (dto.employeeId !== undefined) {
      await this.links.apply(manager, user, dto.employeeId);
    }
    if (dto.extraData !== undefined) {
      user.extraData = mergeExtraData(user.extraData, dto.extraData);
    }
  }

  /** Khung chung: khóa tài khoản, chụp trước/sau, áp dụng `change`, lưu, đồng bộ, rồi ghi audit một lần. */
  private async mutate(
    id: string,
    ctx: UserAuditContext,
    actionType: UserAuditAction,
    change: Change,
    message?: string,
  ): Promise<UserResponseDto> {
    const { before, after } = await this.run(() =>
      this.dataSource.transaction(async (manager) => {
        const repo = manager.getRepository(UsersManagement);
        const user = await repo.findOne({
          where: { id, isDeleted: false },
          lock: { mode: 'pessimistic_write' },
        });
        if (!user) throw new NotFoundException('Không tìm thấy tài khoản');
        const before = toUserResponse(
          user,
          await this.loadEmployee(manager, user.employeeId),
        );
        await change(manager, user);
        const saved = await repo.save(user);
        await syncToLegacyCoreUser(manager, saved);
        const after = toUserResponse(
          saved,
          await this.loadEmployee(manager, saved.employeeId),
        );
        return { before, after };
      }),
    );

    await this.audit.write(ctx, {
      actionType,
      entityId: id,
      beforeSnapshot: { ...before },
      afterSnapshot: { ...after },
      message,
    });
    return after;
  }

  private loadEmployee(
    manager: EntityManager,
    employeeId: string | null,
  ): Promise<EmployeeManagement | null> {
    if (!employeeId) return Promise.resolve(null);
    return manager.getRepository(EmployeeManagement).findOne({
      where: { id: employeeId },
    });
  }

  /** Vi phạm unique (email hoặc nhân viên) do đua request thì trả 409 thay vì 500. */
  private async run<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if ((error as { code?: string }).code === PG_UNIQUE_VIOLATION) {
        throw new ConflictException(
          'Email hoặc nhân viên đã được dùng cho tài khoản khác',
        );
      }
      throw error;
    }
  }
}
