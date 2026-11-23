import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RbacUserRole } from '@/v2/modules/rbac-roles/entities/rbac-user-role.entity';
import {
  canViewTestAccounts,
  HIDDEN_TEST_EMAILS,
  isHiddenTestEmail,
} from '@/v2/core/users-core';
import { UpdateCoreRoleUsersDto } from '../dto/rbac-core.dto';
import type { RoleUserResponse } from '../dto/rbac-response.dto';
import { toRoleUser } from '../helpers/rbac-role.mapper';

/** Người dùng được gán vào một role. Ghi bằng cách thay toàn bộ danh sách. */
@Injectable()
export class RoleUsersService {
  constructor(
    @InjectRepository(RbacUserRole)
    private readonly userRoleRepository: Repository<RbacUserRole>,
  ) {}

  async getRoleUsers(
    roleId: string,
    viewerEmail?: string | null,
  ): Promise<RoleUserResponse[]> {
    const userRoles = await this.userRoleRepository.find({
      where: { roleId },
      relations: ['user'],
    });
    const visible = canViewTestAccounts(viewerEmail)
      ? userRoles
      : userRoles.filter((ur) => !isHiddenTestEmail(ur.user?.email));
    return visible.map((ur) => toRoleUser(ur.user));
  }

  async updateRoleUsers(
    roleId: string,
    dto: UpdateCoreRoleUsersDto,
    viewerEmail?: string | null,
  ): Promise<{ success: boolean }> {
    if (canViewTestAccounts(viewerEmail)) {
      await this.userRoleRepository.delete({ roleId });
      await this.insertUserRoles(roleId, dto.userIds);
      return { success: true };
    }

    // Người không có quyền: giữ nguyên gán role của tài khoản test, không gán thêm hoặc gỡ chúng.
    const hiddenIds = await this.findHiddenUserIds();
    const current = await this.userRoleRepository.find({ where: { roleId } });
    const removable = current
      .filter((ur) => !hiddenIds.includes(ur.userId))
      .map((ur) => ur.id);
    if (removable.length > 0) {
      await this.userRoleRepository.delete(removable);
    }
    const allowed = dto.userIds.filter((id) => !hiddenIds.includes(id));
    await this.insertUserRoles(roleId, allowed);
    return { success: true };
  }

  private async insertUserRoles(roleId: string, userIds: string[]) {
    const unique = [...new Set(userIds)];
    if (unique.length === 0) return;
    const rows = unique.map((userId) =>
      this.userRoleRepository.create({ roleId, userId }),
    );
    await this.userRoleRepository.save(rows);
  }

  /** Id tài khoản test, lấy từ bảng nguồn `users_management`. */
  private async findHiddenUserIds(): Promise<string[]> {
    const rows: { id: string }[] = await this.userRoleRepository.query(
      'SELECT id FROM users_management WHERE LOWER(email) = ANY($1)',
      [[...HIDDEN_TEST_EMAILS]],
    );
    return rows.map((row) => row.id);
  }
}
