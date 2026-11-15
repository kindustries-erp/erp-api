import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { EntityManager } from 'typeorm';
import { ErpEmployee } from '@/employees-core/entities/erp_employee.entity';
import {
  hashPassword,
  normalizeEmail,
  USER_STATUS_ACTIVE,
  verifyPassword,
} from '@/v2/core/users-core';
import { UsersManagement } from '../entities/users-management.entity';
import {
  revokeAllUserSessions,
  syncToLegacyCoreUser,
} from './legacy-core-user.sync';

const PG_UNIQUE_VIOLATION = '23505';

export interface OwnProfileInput {
  email?: string | null;
  fullName?: string | null;
  phone?: string | null;
  notes?: string | null;
}

export type ChangePasswordResult =
  | { status: 'OK'; user: UsersManagement }
  | { status: 'WRONG_PASSWORD'; user: UsersManagement }
  | { status: 'NOT_FOUND'; user: null };

/**
 * Thao tác tài khoản dành cho auth (đăng nhập, đổi mật khẩu, hồ sơ cá nhân, seed).
 * `users_management` là nguồn chính; mỗi thao tác ghi trong MỘT transaction, khóa hàng tài khoản
 * (`pessimistic_write`) rồi ghi bản sao sang `core_users` để các FK cũ vẫn chạy.
 * Không ghi audit ở đây: auth ghi audit module `auth` ở tầng gọi.
 */
@Injectable()
export class UsersAuthService {
  private dummyHash: Promise<string> | null = null;

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  findById(id: string): Promise<UsersManagement | null> {
    return this.dataSource
      .getRepository(UsersManagement)
      .findOne({ where: { id, isDeleted: false } });
  }

  findByEmail(email: string): Promise<UsersManagement | null> {
    return this.dataSource
      .getRepository(UsersManagement)
      .findOne({ where: { email: normalizeEmail(email), isDeleted: false } });
  }

  getEmployee(employeeId: string | null): Promise<ErpEmployee | null> {
    if (!employeeId) return Promise.resolve(null);
    return this.dataSource
      .getRepository(ErpEmployee)
      .findOne({ where: { id: employeeId } });
  }

  /**
   * Kiểm tra email và mật khẩu. Khi không có tài khoản vẫn so khớp với hash giả để thời gian phản hồi
   * không lộ email có tồn tại hay không.
   */
  async authenticate(
    email: string,
    password: string,
  ): Promise<{ user: UsersManagement | null; valid: boolean }> {
    const user = await this.findByEmail(email);
    const hash = user?.passwordHash ?? (await this.getDummyHash());
    const matched = await verifyPassword(password, hash);
    return { user, valid: Boolean(user) && matched };
  }

  /** Ghi mốc đăng nhập đúng một chỗ (users_management và bản sao core_users). */
  async recordLogin(userId: string): Promise<Date | null> {
    return this.dataSource.transaction(async (manager) => {
      const user = await this.lock(manager, userId);
      if (!user) return null;
      user.lastLoginAt = new Date();
      await this.persist(manager, user);
      return user.lastLoginAt;
    });
  }

  async changeOwnPassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<ChangePasswordResult> {
    const newHash = await hashPassword(newPassword);
    return this.dataSource.transaction(async (manager) => {
      const user = await this.lock(manager, userId);
      if (!user) return { status: 'NOT_FOUND', user: null };
      if (!(await verifyPassword(oldPassword, user.passwordHash))) {
        return { status: 'WRONG_PASSWORD', user };
      }
      user.passwordHash = newHash;
      user.passwordChangedAt = new Date();
      await this.persist(manager, user);
      await revokeAllUserSessions(manager, user.id);
      return { status: 'OK', user };
    });
  }

  async updateOwnProfile(
    userId: string,
    input: OwnProfileInput,
  ): Promise<{ user: UsersManagement; employee: ErpEmployee | null } | null> {
    const email = input.email ? normalizeEmail(input.email) : undefined;
    try {
      return await this.dataSource.transaction(async (manager) => {
        const user = await this.lock(manager, userId);
        if (!user) return null;
        if (email && email !== user.email) {
          const taken = await manager
            .getRepository(UsersManagement)
            .exists({ where: { email } });
          if (taken) throw new ConflictException('Email đã tồn tại');
          user.email = email;
        }
        const employee = await this.applyEmployeeFields(
          manager,
          user,
          input,
          email,
        );
        await this.persist(manager, user);
        return { user, employee };
      });
    } catch (error) {
      if ((error as { code?: string }).code === PG_UNIQUE_VIOLATION) {
        throw new ConflictException('Email đã tồn tại');
      }
      throw error;
    }
  }

  /** Tạo tài khoản quản trị mặc định khi chưa có (seed lúc khởi động). Idempotent. */
  async ensureSeedUser(email: string, password: string): Promise<void> {
    const normalized = normalizeEmail(email);
    const passwordHash = await hashPassword(password);
    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(UsersManagement);
      if (await repo.exists({ where: { email: normalized } })) return;
      const user = await repo.save(
        repo.create({
          email: normalized,
          passwordHash,
          status: USER_STATUS_ACTIVE,
          employeeId: null,
          legacyDirectusUserId: null,
          lastLoginAt: null,
          createdBy: null,
          passwordChangedAt: null,
          isDeleted: false,
          extraData: {},
        }),
      );
      await syncToLegacyCoreUser(manager, user);
    });
  }

  private async applyEmployeeFields(
    manager: EntityManager,
    user: UsersManagement,
    input: OwnProfileInput,
    email: string | undefined,
  ): Promise<ErpEmployee | null> {
    const hasFields =
      input.fullName !== undefined ||
      input.phone !== undefined ||
      input.notes !== undefined;
    const employee = user.employeeId
      ? await manager.getRepository(ErpEmployee).findOne({
          where: { id: user.employeeId },
          lock: { mode: 'pessimistic_write' },
        })
      : null;
    if (!employee) {
      if (hasFields) {
        throw new BadRequestException(
          'Tài khoản chưa liên kết hồ sơ nhân viên, chưa thể cập nhật họ tên/số điện thoại/ghi chú.',
        );
      }
      return null;
    }
    const fullName = input.fullName?.trim();
    if (fullName) employee.fullName = fullName;
    if (input.phone !== undefined) employee.phone = input.phone?.trim() || null;
    if (input.notes !== undefined) employee.notes = input.notes?.trim() || null;
    if (email) employee.email = email;
    return manager.getRepository(ErpEmployee).save(employee);
  }

  private lock(
    manager: EntityManager,
    id: string,
  ): Promise<UsersManagement | null> {
    return manager.getRepository(UsersManagement).findOne({
      where: { id, isDeleted: false },
      lock: { mode: 'pessimistic_write' },
    });
  }

  private async persist(
    manager: EntityManager,
    user: UsersManagement,
  ): Promise<void> {
    await manager.getRepository(UsersManagement).save(user);
    await syncToLegacyCoreUser(manager, user);
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= hashPassword('khong-phai-mat-khau-that');
    return this.dummyHash;
  }
}
