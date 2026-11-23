import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RbacPermission } from '@/v2/modules/rbac-roles/entities/rbac-permission.entity';
import { UpdateCoreRolePermissionsDto } from '../dto/rbac-core.dto';
import type { PermissionResponse } from '../dto/rbac-response.dto';
import { toPermissionResponse } from '../helpers/rbac-role.mapper';

/** Quyền (resource, action) của một role. Ghi bằng cách thay toàn bộ danh sách. */
@Injectable()
export class RolePermissionsService {
  constructor(
    @InjectRepository(RbacPermission)
    private readonly permissionRepository: Repository<RbacPermission>,
  ) {}

  async getRolePermissions(roleId: string): Promise<PermissionResponse[]> {
    const permissions = await this.permissionRepository.find({
      where: { roleId },
    });
    return permissions.map(toPermissionResponse);
  }

  async updateRolePermissions(
    roleId: string,
    dto: UpdateCoreRolePermissionsDto,
  ): Promise<{ success: boolean }> {
    await this.permissionRepository.delete({ roleId });
    const newPerms = dto.permissions.map((p) =>
      this.permissionRepository.create({
        roleId,
        resource: p.resource,
        action: p.action,
        conditions: p.conditions,
      }),
    );
    await this.permissionRepository.save(newPerms);
    return { success: true };
  }
}
