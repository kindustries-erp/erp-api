import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import type { Request } from 'express';
import { CoreUser } from '../users/entities/core-user.entity';
import { ErpEmployee } from '../employees-core/entities/erp_employee.entity';
import { UsersService } from '../users/users.service';
import { AuditCoreService } from '../audit-core/audit-core.service';
import {
  applyMultiKeywordFilter,
  applyMultiKeywordMultiFieldFilter,
} from '../common/utils/query-builder.util';
import {
  ChangePasswordSelfDto,
  CreateUserAdminDto,
  LinkEmployeeDto,
  ListUsersAdminDto,
  ResetPasswordAdminDto,
  UpdateUserAdminDto,
} from './dto/user-admin.dto';

@Injectable()
export class UsersAdminService {
  constructor(
    @InjectRepository(CoreUser)
    private readonly usersRepository: Repository<CoreUser>,
    @InjectRepository(ErpEmployee)
    private readonly employeesRepository: Repository<ErpEmployee>,
    private readonly usersService: UsersService,
    private readonly auditCoreService: AuditCoreService,
  ) {}

  private toSafeUser(user: CoreUser, employee?: ErpEmployee | null) {
    return {
      id: user.id,
      email: user.email,
      status: user.status,
      employeeId: user.employeeId,
      legacyDirectusUserId: user.legacyDirectusUserId,
      lastLoginAt: user.lastLoginAt ?? null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      employee: employee
        ? {
            id: employee.id,
            fullName: employee.fullName,
            employeeCode: employee.employeeCode,
            email: employee.email,
            phone: employee.phone,
            status: employee.status,
          }
        : null,
    };
  }

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
    request: Request & { user?: { sub?: string; email?: string } },
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

  async createUser(
    dto: CreateUserAdminDto,
    request: Request & { user?: { sub?: string; email?: string } },
  ) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email đã tồn tại');
    }

    const employee = await this.getEmployeeOrNull(dto.employeeId);
    if (employee?.userId) {
      throw new ConflictException('Employee này đã liên kết user khác');
    }

    const newUser = this.usersRepository.create({
      email: dto.email.toLowerCase().trim(),
      passwordHash: this.usersService.hashPassword(dto.password),
      status: 'ACTIVE',
      employeeId: employee?.id ?? null,
      legacyDirectusUserId: null,
      createdBy: request.user?.sub ?? null,
      lastLoginAt: null,
      passwordChangedAt: null,
    });
    const user = await this.usersRepository.save(newUser);

    if (employee) {
      employee.userId = user.id;
      if (!employee.email) employee.email = user.email;
      await this.employeesRepository.save(employee);
    }

    const safe = this.toSafeUser(user, employee);
    await this.writeAudit(request, {
      actionType: 'CREATE_USER',
      entityType: 'core_user',
      entityId: user.id,
      afterSnapshot: safe,
    });

    return { message: 'Tạo user thành công', data: safe };
  }

  private mapColumnToSqlField(column: string): string | null {
    switch (column) {
      case 'email':
        return 'user.email';
      case 'status':
        return 'user.status';
      case 'employee':
      case 'employeeName':
        return 'emp.fullName';
      case 'employeeCode':
        return 'emp.employeeCode';
      case 'lastLoginAt':
        return 'user.lastLoginAt';
      case 'createdAt':
        return 'user.createdAt';
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

    const qb = this.usersRepository.createQueryBuilder('user');
    qb.leftJoin(ErpEmployee, 'emp', 'emp.id = user.employeeId');

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
                if (key === 'employee') {
                  applyMultiKeywordMultiFieldFilter(
                    qb,
                    ['emp.fullName', 'emp.employeeCode'],
                    searchStr,
                    `c_opt_flt_all_${idx}`,
                  );
                } else {
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

    if (column === 'employee') {
      qb.select(
        "COALESCE(emp.fullName || ' (' || emp.employeeCode || ')', emp.fullName, emp.employeeCode)",
        'value',
      );
    } else {
      qb.select(`${rawSqlField}`, 'value');
    }
    qb.addSelect('COUNT(*)', 'count');
    qb.andWhere(
      `${rawSqlField} IS NOT NULL AND CAST(${rawSqlField} AS text) != ''`,
    );

    if (search && search.trim()) {
      if (column === 'employee') {
        applyMultiKeywordMultiFieldFilter(
          qb,
          ['emp.fullName', 'emp.employeeCode'],
          search.trim(),
          'col_opt_search',
        );
      } else {
        applyMultiKeywordFilter(
          qb,
          rawSqlField,
          search.trim(),
          'col_opt_search',
        );
      }
    }

    if (column === 'employee') {
      qb.groupBy(
        "COALESCE(emp.fullName || ' (' || emp.employeeCode || ')', emp.fullName, emp.employeeCode)",
      );
      qb.orderBy(
        "COALESCE(emp.fullName || ' (' || emp.employeeCode || ')', emp.fullName, emp.employeeCode)",
        'ASC',
      );
    } else {
      qb.groupBy(`${rawSqlField}`);
      qb.orderBy(`${rawSqlField}`, 'ASC');
    }

    const countQb = qb.clone();
    const totalRaw = await countQb.getRawMany();
    const total = totalRaw.length;

    qb.offset((page - 1) * pageSize).limit(pageSize);
    const rows = await qb.getRawMany();

    const items = rows.map((r) => ({
      label: String(r.value),
      value: String(r.value),
    }));

    const next = page * pageSize < total ? page + 1 : null;
    return { items, total, next };
  }

  async listUsers(query: ListUsersAdminDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.max(1, Number(query.pageSize) || 20);
    const qb = this.usersRepository.createQueryBuilder('user');
    qb.leftJoin(ErpEmployee, 'emp', 'emp.id = user.employeeId');

    if (query.status) {
      qb.andWhere('user.status = :status', { status: query.status });
    }

    if (query.search && query.search.trim()) {
      applyMultiKeywordMultiFieldFilter(
        qb,
        ['user.email', 'emp.fullName', 'emp.employeeCode'],
        query.search.trim(),
        'global_search',
      );
    }

    if (query.linkedEmployee === true) {
      qb.andWhere('user.employeeId IS NOT NULL');
    }
    if (query.linkedEmployee === false) {
      qb.andWhere('user.employeeId IS NULL');
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
            if (key === 'employee') {
              applyMultiKeywordMultiFieldFilter(
                qb,
                ['emp.fullName', 'emp.employeeCode'],
                val.trim(),
                `col_search_${idx}`,
              );
            } else {
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
                if (key === 'employee') {
                  applyMultiKeywordMultiFieldFilter(
                    qb,
                    ['emp.fullName', 'emp.employeeCode'],
                    searchStr,
                    `col_filter_all_${idx}`,
                  );
                } else {
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
      qb.andWhere('user.createdAt >= :dateFrom', { dateFrom: query.date_from });
    }
    if (query.date_to) {
      const dTo =
        query.date_to.length === 10
          ? `${query.date_to} 23:59:59.999`
          : query.date_to;
      qb.andWhere('user.createdAt <= :dateTo', { dateTo: dTo });
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
        qb.orderBy('user.createdAt', 'DESC');
      }
    } else {
      qb.orderBy('user.createdAt', 'DESC');
    }

    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const [rows, total] = await qb.getManyAndCount();
    const employeeIds = rows
      .map((row) => row.employeeId)
      .filter(Boolean) as string[];
    const employees = employeeIds.length
      ? await this.employeesRepository.find({ where: { id: In(employeeIds) } })
      : [];
    const employeeMap = new Map(
      employees.map((employee) => [employee.id, employee]),
    );

    return {
      data: rows.map((row) =>
        this.toSafeUser(
          row,
          row.employeeId ? (employeeMap.get(row.employeeId) ?? null) : null,
        ),
      ),
      total,
      page,
      pageSize,
    };
  }

  async getUser(id: string) {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Không tìm thấy user');
    const employee = await this.getEmployeeOrNull(user.employeeId);
    return { data: this.toSafeUser(user, employee) };
  }

  async updateUser(
    id: string,
    dto: UpdateUserAdminDto,
    request: Request & { user?: { sub?: string; email?: string } },
  ) {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Không tìm thấy user');
    const before = this.toSafeUser(
      user,
      await this.getEmployeeOrNull(user.employeeId),
    );

    if (dto.status) user.status = dto.status;
    if (dto.employeeId !== undefined) {
      if (user.employeeId && user.employeeId !== dto.employeeId) {
        const oldEmployee = await this.getEmployeeOrNull(user.employeeId);
        if (oldEmployee) {
          oldEmployee.userId = null;
          await this.employeesRepository.save(oldEmployee);
        }
      }

      if (dto.employeeId) {
        const nextEmployee = await this.getEmployeeOrNull(dto.employeeId);
        if (nextEmployee?.userId && nextEmployee.userId !== user.id) {
          throw new ConflictException('Employee này đã liên kết user khác');
        }
        if (nextEmployee) {
          nextEmployee.userId = user.id;
          if (!nextEmployee.email) nextEmployee.email = user.email;
          await this.employeesRepository.save(nextEmployee);
          user.employeeId = nextEmployee.id;
        }
      } else {
        user.employeeId = null;
      }
    }

    const saved = await this.usersRepository.save(user);
    const employee = await this.getEmployeeOrNull(saved.employeeId);
    const after = this.toSafeUser(saved, employee);
    await this.writeAudit(request, {
      actionType: 'UPDATE_USER',
      entityType: 'core_user',
      entityId: saved.id,
      beforeSnapshot: before,
      afterSnapshot: after,
    });
    return { message: 'Cập nhật user thành công', data: after };
  }

  async activateUser(
    id: string,
    request: Request & { user?: { sub?: string; email?: string } },
  ) {
    return this.updateUser(id, { status: 'ACTIVE' }, request).then((res) => {
      void this.writeAudit(request, {
        actionType: 'ACTIVATE_USER',
        entityType: 'core_user',
        entityId: id,
      });
      return { message: 'Kích hoạt user thành công', data: res.data };
    });
  }

  async deactivateUser(
    id: string,
    request: Request & { user?: { sub?: string; email?: string } },
  ) {
    return this.updateUser(id, { status: 'INACTIVE' }, request).then((res) => {
      void this.writeAudit(request, {
        actionType: 'DEACTIVATE_USER',
        entityType: 'core_user',
        entityId: id,
      });
      return { message: 'Ngưng user thành công', data: res.data };
    });
  }

  async resetPassword(
    id: string,
    dto: ResetPasswordAdminDto,
    request: Request & { user?: { sub?: string; email?: string } },
  ) {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Không tìm thấy user');
    user.passwordHash = this.usersService.hashPassword(dto.newPassword);
    user.passwordChangedAt = new Date();
    await this.usersRepository.save(user);
    await this.writeAudit(request, {
      actionType: 'RESET_PASSWORD',
      entityType: 'core_user',
      entityId: id,
      message: 'Admin reset password',
    });
    return { message: 'Reset password thành công' };
  }

  async changeSelfPassword(
    userId: string,
    dto: ChangePasswordSelfDto,
    request: Request & { user?: { sub?: string; email?: string } },
  ) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Không tìm thấy user');
    if (!this.usersService.verifyPassword(dto.oldPassword, user.passwordHash)) {
      await this.writeAudit(request, {
        actionType: 'CHANGE_PASSWORD',
        entityType: 'core_user',
        entityId: userId,
        status: 'FAIL',
        message: 'Sai mật khẩu cũ',
      });
      throw new UnauthorizedException('Mật khẩu cũ không đúng');
    }
    user.passwordHash = this.usersService.hashPassword(dto.newPassword);
    user.passwordChangedAt = new Date();
    await this.usersRepository.save(user);
    await this.writeAudit(request, {
      actionType: 'CHANGE_PASSWORD',
      entityType: 'core_user',
      entityId: userId,
    });
    return { message: 'Đổi mật khẩu thành công' };
  }

  async linkEmployee(
    id: string,
    dto: LinkEmployeeDto,
    request: Request & { user?: { sub?: string; email?: string } },
  ) {
    return this.updateUser(id, { employeeId: dto.employeeId }, request).then(
      (res) => {
        void this.writeAudit(request, {
          actionType: 'LINK_EMPLOYEE',
          entityType: 'core_user',
          entityId: id,
        });
        return { message: 'Liên kết employee thành công', data: res.data };
      },
    );
  }

  async unlinkEmployee(
    id: string,
    request: Request & { user?: { sub?: string; email?: string } },
  ) {
    return this.updateUser(id, { employeeId: null }, request).then((res) => {
      void this.writeAudit(request, {
        actionType: 'UNLINK_EMPLOYEE',
        entityType: 'core_user',
        entityId: id,
      });
      return { message: 'Gỡ liên kết employee thành công', data: res.data };
    });
  }
}
