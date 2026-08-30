import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, In } from 'typeorm';
import { CoreRole } from './entities/core-role.entity';
import { CorePermission } from './entities/core-permission.entity';
import { CoreUserRole } from './entities/core-user-role.entity';
import { CoreUser } from '../users/entities/core-user.entity';
import {
  CreateCoreRoleDto,
  ListCoreRolesDto,
  UpdateCoreRoleDto,
  UpdateCoreRolePermissionsDto,
  UpdateCoreRoleUsersDto,
} from './dto/rbac-core.dto';
import {
  applyMultiKeywordFilter,
  applyMultiKeywordMultiFieldFilter,
} from '../common/utils/query-builder.util';

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
    const matchResources = [resource, '*'];
    if (resource === 'garage') {
      matchResources.push('greenway_integration', 'kgara_integration');
    }
    return permissions.some(
      (p) =>
        matchResources.includes(p.resource) &&
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

  private mapColumnToSqlField(column: string): string | null {
    switch (column) {
      case 'name':
        return 'role.name';
      case 'description':
        return 'role.description';
      case 'isActive':
      case 'is_active':
      case 'status':
        return 'role.isActive';
      case 'createdAt':
        return 'role.createdAt';
      default:
        return null;
    }
  }

  async getColumnOptions(
    column: string,
    search?: string,
    page: number = 1,
    pageSize: number = 20,
    filtersStr?: string,
  ) {
    const rawSqlField = this.mapColumnToSqlField(column);
    if (!rawSqlField) {
      return { items: [], total: 0, next: null };
    }

    const qb = this.roleRepository.createQueryBuilder('role');

    // Cross-column filters
    if (filtersStr) {
      try {
        const filters: Record<string, string[]> =
          typeof filtersStr === 'string' ? JSON.parse(filtersStr) : filtersStr;
        Object.entries(filters).forEach(([key, values], idx) => {
          if (key !== column && Array.isArray(values) && values.length > 0) {
            // 1. Support __ALL_MATCHING__
            if (values[0] === '__ALL_MATCHING__') {
              const searchStr = (values[1] || '').trim();
              if (searchStr) {
                const sqlField = this.mapColumnToSqlField(key);
                if (sqlField) {
                  applyMultiKeywordFilter(
                    qb,
                    sqlField,
                    searchStr,
                    `c_opt_flt_all_${idx}`,
                  );
                }
              }
              return;
            }

            const sqlField = this.mapColumnToSqlField(key);
            if (sqlField) {
              const hasBlank = values.includes('__BLANK__');
              const nonBlankValues = values.filter((v) => v !== '__BLANK__');
              const pName = `c_opt_flt_${idx}`;

              if (hasBlank && nonBlankValues.length > 0) {
                qb.andWhere(
                  new Brackets((sqb) => {
                    sqb
                      .where(`${sqlField} IN (:...${pName})`, {
                        [pName]: nonBlankValues,
                      })
                      .orWhere(
                        `(${sqlField} IS NULL OR CAST(${sqlField} AS text) = '')`,
                      );
                  }),
                );
              } else if (hasBlank) {
                qb.andWhere(
                  `(${sqlField} IS NULL OR CAST(${sqlField} AS text) = '')`,
                );
              } else if (nonBlankValues.length > 0) {
                qb.andWhere(`${sqlField} IN (:...${pName})`, {
                  [pName]: nonBlankValues,
                });
              }
            }
          }
        });
      } catch (e) {
        // Ignore JSON error
      }
    }

    qb.select(`${rawSqlField}`, 'value');
    qb.addSelect('COUNT(*)', 'count');
    qb.andWhere(
      `${rawSqlField} IS NOT NULL AND CAST(${rawSqlField} AS text) != ''`,
    );

    if (search && search.trim()) {
      applyMultiKeywordFilter(qb, rawSqlField, search.trim(), 'col_opt_search');
    }

    qb.groupBy(`${rawSqlField}`);
    qb.orderBy(`${rawSqlField}`, 'ASC');

    const countQb = qb.clone();
    const totalRaw = await countQb.getRawMany();
    const total = totalRaw.length;

    qb.offset((page - 1) * pageSize).limit(pageSize);
    const rows = await qb.getRawMany();

    const items = rows.map((r) => {
      let label = String(r.value);
      if (
        column === 'isActive' ||
        column === 'is_active' ||
        column === 'status'
      ) {
        label = r.value === true || r.value === 'true' ? 'Hoạt động' : 'Ngưng';
      }
      return {
        label,
        value: String(r.value),
      };
    });

    const next = page * pageSize < total ? page + 1 : null;
    return { items, total, next };
  }

  async getRolesPaginated(query: ListCoreRolesDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.max(1, Number(query.pageSize) || 20);
    const qb = this.roleRepository
      .createQueryBuilder('role')
      .leftJoinAndSelect('role.userRoles', 'ur')
      .leftJoinAndSelect('ur.user', 'user');

    if (query.search && query.search.trim()) {
      applyMultiKeywordMultiFieldFilter(
        qb,
        ['role.name', 'role.description'],
        query.search.trim(),
        'global_search',
      );
    }

    // Column Search
    if (query.column_search) {
      try {
        const searches: Record<string, string> =
          typeof query.column_search === 'string'
            ? JSON.parse(query.column_search)
            : query.column_search;
        Object.entries(searches).forEach(([key, val], idx) => {
          if (val && typeof val === 'string' && val.trim()) {
            const sqlField = this.mapColumnToSqlField(key);
            if (sqlField) {
              applyMultiKeywordFilter(
                qb,
                sqlField,
                val.trim(),
                `col_search_${idx}`,
              );
            }
          }
        });
      } catch (e) {
        // Ignore
      }
    }

    // Column Filters
    if (query.column_filters) {
      try {
        const filters: Record<string, string[]> =
          typeof query.column_filters === 'string'
            ? JSON.parse(query.column_filters)
            : query.column_filters;
        Object.entries(filters).forEach(([key, values], idx) => {
          if (Array.isArray(values) && values.length > 0) {
            // 1. Support __ALL_MATCHING__
            if (values[0] === '__ALL_MATCHING__') {
              const searchStr = (values[1] || '').trim();
              if (searchStr) {
                const sqlField = this.mapColumnToSqlField(key);
                if (sqlField) {
                  applyMultiKeywordFilter(
                    qb,
                    sqlField,
                    searchStr,
                    `col_filter_all_${idx}`,
                  );
                }
              }
              return;
            }

            const sqlField = this.mapColumnToSqlField(key);
            if (sqlField) {
              const hasBlank = values.includes('__BLANK__');
              const nonBlankValues = values.filter((v) => v !== '__BLANK__');
              const pName = `col_filter_${idx}`;

              if (hasBlank && nonBlankValues.length > 0) {
                qb.andWhere(
                  new Brackets((sqb) => {
                    sqb
                      .where(`${sqlField} IN (:...${pName})`, {
                        [pName]: nonBlankValues,
                      })
                      .orWhere(
                        `(${sqlField} IS NULL OR CAST(${sqlField} AS text) = '')`,
                      );
                  }),
                );
              } else if (hasBlank) {
                qb.andWhere(
                  `(${sqlField} IS NULL OR CAST(${sqlField} AS text) = '')`,
                );
              } else if (nonBlankValues.length > 0) {
                qb.andWhere(`${sqlField} IN (:...${pName})`, {
                  [pName]: nonBlankValues,
                });
              }
            }
          }
        });
      } catch (e) {
        // Ignore
      }
    }

    // Date range filter
    if (query.date_from) {
      qb.andWhere('role.createdAt >= :dateFrom', { dateFrom: query.date_from });
    }
    if (query.date_to) {
      const dTo =
        query.date_to.length === 10
          ? `${query.date_to} 23:59:59.999`
          : query.date_to;
      qb.andWhere('role.createdAt <= :dateTo', { dateTo: dTo });
    }

    // Sorts
    if (query.sorts) {
      const sortList = Array.isArray(query.sorts) ? query.sorts : [query.sorts];
      let hasOrder = false;
      sortList.forEach((s) => {
        if (typeof s === 'string' && s.trim()) {
          const isDesc = s.startsWith('-');
          const fieldKey = isDesc ? s.substring(1) : s;
          const sqlField = this.mapColumnToSqlField(fieldKey);
          if (sqlField) {
            qb.addOrderBy(sqlField, isDesc ? 'DESC' : 'ASC');
            hasOrder = true;
          }
        }
      });
      if (!hasOrder) {
        qb.orderBy('role.createdAt', 'DESC');
      }
    } else {
      qb.orderBy('role.createdAt', 'DESC');
    }

    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const [items, total] = await qb.getManyAndCount();

    // Map output to match frontend UI expectations
    const mappedItems = items.map((role) => ({
      id: role.id,
      name: role.name,
      description: role.description,
      is_active: role.isActive,
      createdAt: role.createdAt,
      users: (role.userRoles || []).map((ur) => ({
        id: ur.user?.id,
        email: ur.user?.email,
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
      { resource: 'inventory_adjustments', label: 'Điều chỉnh kho' },
      { resource: 'bom', label: 'BOM' },
      { resource: 'production', label: 'Production' },
      { resource: 'activity_logs', label: 'Activity Logs' },
      { resource: 'email_ingest', label: 'Email Ingest / Hộp thư' },
      { resource: 'journal_entries', label: 'Journal Entries (Kế toán)' },
      { resource: 'garage', label: 'Garage (Xưởng dịch vụ)' },
      { resource: 'greenway_integration', label: 'Garage / Kgara (Legacy)' },
      {
        resource: 'accounting_configs',
        label: 'Accounting Configs (Cấu hình kế toán)',
      },
      { resource: 'invoices', label: 'Hóa đơn' },
      { resource: 'sales_reports', label: 'Sales Reports' },
      { resource: 'purchasing_reports', label: 'Purchasing Reports' },
      { resource: 'sys_tags', label: 'Tags' },
      { resource: 'bank_accounts', label: 'Bank Accounts & Cash Books' },
      { resource: 'bank_statements', label: 'Bank Statements (Import)' },
      {
        resource: 'purchase_requests',
        label: 'Purchase Requests / Yêu cầu mua hàng',
      },
      { resource: 'vehicles', label: 'Vehicles / Xe cộ' },
      {
        resource: 'kgara_integration',
        label: 'Kgara Integration (Garage)',
      },
      {
        resource: 'vinfast',
        label: 'Vinfast (Phụ tùng & Xưởng)',
      },
    ];
  }
}
