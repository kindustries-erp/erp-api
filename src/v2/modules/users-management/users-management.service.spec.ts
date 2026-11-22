import { NotFoundException } from '@nestjs/common';
import type { EmployeeManagement } from '@/v2/modules/employees-management/entities/employee-management.entity';
import type { UsersManagement } from './entities/users-management.entity';
import type { UserAuditContext } from './helpers/audit-context';
import type { UsersManagementCommandService } from './services/users-management-command.service';
import type { UsersManagementQueryService } from './services/users-management-query.service';
import { UsersManagementService } from './users-management.service';

const user = (over: Partial<UsersManagement> = {}): UsersManagement =>
  ({
    id: 'u1',
    email: 'a@b.co',
    passwordHash: 'SECRET',
    status: 'ACTIVE',
    employeeId: null,
    extraData: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  }) as UsersManagement;

describe('UsersManagementService (facade)', () => {
  let query: Record<string, jest.Mock>;
  let command: Record<string, jest.Mock>;
  let service: UsersManagementService;
  const ctx = {} as UserAuditContext;

  beforeEach(() => {
    query = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findVisibleById: jest.fn().mockResolvedValue(user()),
      findEmployeeMap: jest.fn().mockResolvedValue(new Map()),
      findColumnOptions: jest.fn(),
    };
    command = {
      create: jest.fn(),
      update: jest.fn(),
      activate: jest.fn(),
      deactivate: jest.fn(),
      resetPassword: jest.fn(),
      linkEmployee: jest.fn(),
      unlinkEmployee: jest.fn(),
    };
    service = new UsersManagementService(
      query as unknown as UsersManagementQueryService,
      command as unknown as UsersManagementCommandService,
    );
  });

  it('list trả { items, pagination } và không lộ passwordHash', async () => {
    query.findAll.mockResolvedValue({
      items: [user({ employeeId: 'e1' })],
      total: 41,
      page: 2,
      pageSize: 20,
      summaries: {},
    });
    query.findEmployeeMap.mockResolvedValue(
      new Map([
        [
          'e1',
          { id: 'e1', fullName: 'A', employeeCode: 'NV1', status: 'ACTIVE' },
        ],
      ]) as unknown as Map<string, EmployeeManagement>,
    );

    const res = await service.findAll({});

    expect(res.items).toHaveLength(1);
    expect(res.items[0].employee?.employeeCode).toBe('NV1');
    expect(res.pagination).toMatchObject({
      page: 2,
      pageSize: 20,
      total: 41,
      totalPages: 3,
    });
    expect(JSON.stringify(res)).not.toContain('SECRET');
    expect(res).not.toHaveProperty('total');
  });

  it('findOne trả { message, data }; không có thì 404', async () => {
    query.findVisibleById.mockResolvedValueOnce(user());
    const res = await service.findOne('u1');
    expect(res.message).toBeDefined();
    expect(res.data.id).toBe('u1');

    query.findVisibleById.mockResolvedValueOnce(null);
    await expect(service.findOne('x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('mutation bọc kết quả command trong { message, data }', async () => {
    command.create.mockResolvedValue({ id: 'u1' });
    command.activate.mockResolvedValue({ id: 'u1' });
    expect((await service.create({} as never, ctx)).data).toEqual({ id: 'u1' });
    expect((await service.activate('u1', ctx)).data).toEqual({ id: 'u1' });
  });

  it('resetPassword chỉ trả message, không trả dữ liệu tài khoản', async () => {
    const res = await service.resetPassword('u1', {} as never, ctx);
    expect(res).toEqual({ message: expect.any(String) });
  });

  it('linkEmployee truyền employeeId từ DTO', async () => {
    command.linkEmployee.mockResolvedValue({ id: 'u1' });
    await service.linkEmployee('u1', { employeeId: 'e1' }, ctx);
    expect(command.linkEmployee).toHaveBeenCalledWith('u1', 'e1', ctx);
  });
});
