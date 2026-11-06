import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CoreRole } from '@/v2/core/rbac/entities/core-role.entity';
import { CreateCoreRoleDto, UpdateCoreRoleDto } from '../dto/rbac-core.dto';
import type { RoleResponse } from '../dto/rbac-response.dto';
import { toRoleResponse } from '../helpers/rbac-role.mapper';

/** Ghi role: tạo, sửa, xóa cứng (bảng core_roles không có cột is_deleted). */
@Injectable()
export class RoleCommandService {
  constructor(
    @InjectRepository(CoreRole)
    private readonly roleRepository: Repository<CoreRole>,
  ) {}

  async createRole(dto: CreateCoreRoleDto): Promise<RoleResponse> {
    const role = this.roleRepository.create(dto);
    return toRoleResponse(await this.roleRepository.save(role));
  }

  async updateRole(id: string, dto: UpdateCoreRoleDto): Promise<RoleResponse> {
    const role = await this.roleRepository.findOne({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');
    Object.assign(role, dto);
    return toRoleResponse(await this.roleRepository.save(role));
  }

  async deleteRole(id: string): Promise<{ success: boolean }> {
    const role = await this.roleRepository.findOne({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');
    await this.roleRepository.remove(role);
    return { success: true };
  }
}
