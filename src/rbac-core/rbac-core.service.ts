import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { CoreRole } from './entities/core-role.entity';
import { CorePermission } from './entities/core-permission.entity';
import { CoreUserRole } from './entities/core-user-role.entity';
import { CoreUser } from '../users/entities/core-user.entity';
import {
  CreateCoreRoleDto,
  UpdateCoreRoleDto,
  UpdateCoreRolePermissionsDto,
  UpdateCoreRoleUsersDto,
} from './dto/rbac-core.dto';

@Injectable()
export class RbacCoreService {
  private readonly logger = new Logger(RbacCoreService.name);

  constructor(
    @InjectRepository(CoreRole)
    private readonly roleRepository: Repository<CoreRole>,
    @InjectRepository(CorePermission)
    private readonly permissionRepository: Repository<CorePermission>,
    @InjectRepository(CoreUserRole)
    private readonly userRoleRepository: Repository<CoreUserRole>,
  ) {}

  async hasPermission(
    userId: string,
    resource: string,
    action: string,
  ): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    return permissions.some(
      (p) =>
        (p.resource === resource || p.resource === '*') &&
        (p.action === action || p.action === '*'),
    );
  }

  async getUserPermissions(userId: string): Promise<CorePermission[]> {
    const userRoles = await this.userRoleRepository.find({
      where: { userId },
      relations: ['role', 'role.permissions'],
    });

    const activeRoles = userRoles
      .map((ur) => ur.role)
      .filter((role) => role.isActive);

    const permissions: CorePermission[] = [];
    for (const role of activeRoles) {
      if (role.permissions) {
        permissions.push(...role.permissions);
      }
    }

    const uniquePermissionsMap = new Map<string, CorePermission>();
    for (const p of permissions) {
      const key = `${p.resource}:${p.action}`;
      if (!uniquePermissionsMap.has(key)) {
        uniquePermissionsMap.set(key, p);
      }
    }

    return Array.from(uniquePermissionsMap.values());
  }

  async getRolesPaginated(query: {
    page?: string;
    pageSize?: string;
    search?: string;
  }) {
    const page = parseInt(query.page || '1', 10);
    const pageSize = parseInt(query.pageSize || '20', 10);
    const qb = this.roleRepository
      .createQueryBuilder('role')
      .leftJoinAndSelect('role.userRoles', 'ur')
      .leftJoinAndSelect('ur.user', 'user')
      .orderBy('role.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (query.search) {
      qb.andWhere('role.name ILIKE :search OR role.description ILIKE :search', {
        search: `%${query.search}%`,
      });
    }

    const [items, total] = await qb.getManyAndCount();

    // Map output to match frontend UI expectations
    const mappedItems = items.map((role) => ({
      id: role.id,
      name: role.name,
      description: role.description,
      is_active: role.isActive,
      users: role.userRoles.map((ur) => ({
        id: ur.user.id,
        email: ur.user.email,
      })),
    }));

    return {
      items: mappedItems,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async createRole(dto: CreateCoreRoleDto) {
    const role = this.roleRepository.create(dto);
    return this.roleRepository.save(role);
  }

  async updateRole(id: string, dto: UpdateCoreRoleDto) {
    const role = await this.roleRepository.findOne({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');
    Object.assign(role, dto);
    return this.roleRepository.save(role);
  }

  async deleteRole(id: string) {
    const role = await this.roleRepository.findOne({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');
    await this.roleRepository.remove(role);
    return { success: true };
  }

  async getRolePermissions(roleId: string) {
    return this.permissionRepository.find({ where: { roleId } });
  }

  async updateRolePermissions(
    roleId: string,
    dto: UpdateCoreRolePermissionsDto,
  ) {
    // Replace all permissions
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

  async getRoleUsers(roleId: string) {
    const userRoles = await this.userRoleRepository.find({
      where: { roleId },
      relations: ['user'],
    });
    return userRoles.map((ur) => ur.user);
  }

  async updateRoleUsers(roleId: string, dto: UpdateCoreRoleUsersDto) {
    await this.userRoleRepository.delete({ roleId });
    const newUserRoles = dto.userIds.map((userId) =>
      this.userRoleRepository.create({
        roleId,
        userId,
      }),
    );
    if (newUserRoles.length > 0) {
      await this.userRoleRepository.save(newUserRoles);
    }
    return { success: true };
  }

  async getAvailableResources() {
    // Static list of resources for the core DB
    return [
      { resource: '*', label: 'All Resources (Super Admin)' },
      { resource: 'admin_users', label: 'Admin Users' },
      { resource: 'employees', label: 'Employees' },
      { resource: 'cash_funds', label: 'Cash Funds' },
      { resource: 'business_partners', label: 'Business Partners' },
      { resource: 'purchase_orders', label: 'Purchase Orders' },
      { resource: 'sales_orders', label: 'Sales Orders' },
      { resource: 'inventory_items', label: 'Inventory Items' },
      { resource: 'inventory_vouchers', label: 'Chứng từ kho' },
      { resource: 'goods_receipts', label: 'Goods Receipts' },
      { resource: 'goods_issues', label: 'Goods Issues' },
      { resource: 'bom', label: 'BOM' },
      { resource: 'production', label: 'Production' },
      { resource: 'activity_logs', label: 'Activity Logs' },
      { resource: 'journal_entries', label: 'Journal Entries (Kế toán)' },
      {
        resource: 'accounting_configs',
        label: 'Accounting Configs (Cấu hình kế toán)',
      },
      { resource: 'invoices', label: 'Hóa đơn' },
      { resource: 'sys_tags', label: 'Tags' },
      { resource: 'bank_accounts', label: 'Bank Accounts & Cash Books' },
      { resource: 'bank_statements', label: 'Bank Statements (Import)' },
      {
        resource: 'purchase_requests',
        label: 'Purchase Requests / Yêu cầu mua hàng',
      },
      { resource: 'vehicles', label: 'Vehicles / Xe cộ' },
      {
        resource: 'greenway_integration',
        label: 'Greenway Integration (Garage)',
      },
    ];
  }
}
