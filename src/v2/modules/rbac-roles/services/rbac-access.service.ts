import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErpAction, ErpResource, RbacAccessService } from '@/v2/core/rbac-core';
import { RbacPermission } from '../entities/rbac-permission.entity';
import { RbacUserRole } from '../entities/rbac-user-role.entity';

/** Cài đặt TypeORM của engine kiểm quyền: đọc role/quyền từ bảng `rbac_*`. */
@Injectable()
export class TypeOrmRbacAccessService extends RbacAccessService {
  constructor(
    @InjectRepository(RbacUserRole)
    private readonly userRoleRepository: Repository<RbacUserRole>,
  ) {
    super();
  }

  async getUserRoleNames(userId: string): Promise<string[]> {
    const userRoles = await this.userRoleRepository.find({
      where: { userId },
      relations: ['role'],
    });
    return userRoles
      .map((ur) => ur.role)
      .filter((role) => role?.isActive)
      .map((role) => role.name);
  }

  async findUserIdsWithPermissions(
    resource: string,
    actions: string[],
  ): Promise<string[]> {
    const rows = await this.userRoleRepository
      .createQueryBuilder('ur')
      .innerJoin('ur.role', 'role', 'role.isActive = :active', {
        active: true,
      })
      .innerJoin('role.permissions', 'perm')
      .select('ur.userId', 'userId')
      .addSelect('perm.action', 'action')
      .where('perm.resource IN (:...resources)', {
        resources: [resource, String(ErpResource.SUPER_ADMIN), '*'],
      })
      .getRawMany<{ userId: string; action: string }>();

    const actionsByUser = new Map<string, Set<string>>();
    for (const row of rows) {
      const set = actionsByUser.get(row.userId) ?? new Set<string>();
      set.add(String(row.action));
      actionsByUser.set(row.userId, set);
    }

    const wildcard = [String(ErpAction.ALL), '*'];
    return [...actionsByUser.entries()]
      .filter(([, granted]) =>
        actions.every(
          (action) =>
            granted.has(action) || wildcard.some((w) => granted.has(w)),
        ),
      )
      .map(([userId]) => userId);
  }

  async getUserPermissions(userId: string): Promise<RbacPermission[]> {
    const userRoles = await this.userRoleRepository.find({
      where: { userId },
      relations: ['role', 'role.permissions'],
    });

    const activeRoles = userRoles
      .map((ur) => ur.role)
      .filter((role) => role.isActive);

    const permissions: RbacPermission[] = [];
    for (const role of activeRoles) {
      if (role.permissions) {
        permissions.push(...role.permissions);
      }
    }

    const uniquePermissionsMap = new Map<string, RbacPermission>();
    for (const p of permissions) {
      const key = `${p.resource}:${p.action}`;
      if (!uniquePermissionsMap.has(key)) {
        uniquePermissionsMap.set(key, p);
      }
    }

    return Array.from(uniquePermissionsMap.values());
  }
}
