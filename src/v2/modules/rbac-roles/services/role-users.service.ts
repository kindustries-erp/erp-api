import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CoreUserRole } from '@/v2/core/rbac-core/entities/core-user-role.entity';
import { UpdateCoreRoleUsersDto } from '../dto/rbac-core.dto';
import type { RoleUserResponse } from '../dto/rbac-response.dto';
import { toRoleUser } from '../helpers/rbac-role.mapper';

/** Người dùng được gán vào một role. Ghi bằng cách thay toàn bộ danh sách. */
@Injectable()
export class RoleUsersService {
  constructor(
    @InjectRepository(CoreUserRole)
    private readonly userRoleRepository: Repository<CoreUserRole>,
  ) {}

  async getRoleUsers(roleId: string): Promise<RoleUserResponse[]> {
    const userRoles = await this.userRoleRepository.find({
      where: { roleId },
      relations: ['user'],
    });
    return userRoles.map((ur) => toRoleUser(ur.user));
  }

  async updateRoleUsers(
    roleId: string,
    dto: UpdateCoreRoleUsersDto,
  ): Promise<{ success: boolean }> {
    await this.userRoleRepository.delete({ roleId });
    const newUserRoles = dto.userIds.map((userId) =>
      this.userRoleRepository.create({ roleId, userId }),
    );
    if (newUserRoles.length > 0) {
      await this.userRoleRepository.save(newUserRoles);
    }
    return { success: true };
  }
}
