import { ConflictException, NotFoundException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { ErpEmployee } from '@/employees-core/entities/erp_employee.entity';
import { UsersManagement } from '../entities/users-management.entity';
import { UsersEmployeeLinkService } from './users-employee-link.service';

const emp = (over: Partial<ErpEmployee> = {}): ErpEmployee =>
  ({
    id: 'e1',
    userId: null,
    email: null,
    fullName: 'A',
    employeeCode: 'NV1',
    ...over,
  }) as ErpEmployee;

const user = (over: Partial<UsersManagement> = {}): UsersManagement =>
  ({ id: 'u1', email: 'a@b.co', employeeId: null, ...over }) as UsersManagement;

describe('UsersEmployeeLinkService', () => {
  let repo: { findOne: jest.Mock; save: jest.Mock };
  let manager: EntityManager;
  const service = new UsersEmployeeLinkService();

  beforeEach(() => {
    repo = {
      findOne: jest.fn(),
      save: jest.fn((v: ErpEmployee) => Promise.resolve(v)),
    };
    manager = {
      getRepository: () => repo,
    } as unknown as EntityManager;
  });

  it('khóa hàng nhân viên bằng pessimistic_write', async () => {
    repo.findOne.mockResolvedValue(emp());
    await service.apply(manager, user(), 'e1');
    expect(repo.findOne.mock.calls[0][0].lock).toEqual({
      mode: 'pessimistic_write',
    });
  });

  it('liên kết: gán userId, bù email còn thiếu, cập nhật employeeId của user', async () => {
    const employee = emp();
    repo.findOne.mockResolvedValue(employee);
    const u = user();
    const result = await service.apply(manager, u, 'e1');
    expect(result).toBe(employee);
    expect(employee.userId).toBe('u1');
    expect(employee.email).toBe('a@b.co');
    expect(u.employeeId).toBe('e1');
  });

  it('không ghi đè email nhân viên đã có', async () => {
    const employee = emp({ email: 'nv@x.vn' });
    repo.findOne.mockResolvedValue(employee);
    await service.apply(manager, user(), 'e1');
    expect(employee.email).toBe('nv@x.vn');
  });

  it('nhân viên đã liên kết tài khoản khác trả 409', async () => {
    repo.findOne.mockResolvedValue(emp({ userId: 'other' }));
    await expect(service.apply(manager, user(), 'e1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('nhân viên không tồn tại trả 404', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.apply(manager, user(), 'e9')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('đổi sang nhân viên khác: giải phóng nhân viên cũ', async () => {
    const previous = emp({ id: 'old', userId: 'u1' });
    const next = emp({ id: 'new' });
    repo.findOne.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve(where.id === 'old' ? previous : next),
    );
    const u = user({ employeeId: 'old' });
    await service.apply(manager, u, 'new');
    expect(previous.userId).toBeNull();
    expect(next.userId).toBe('u1');
    expect(u.employeeId).toBe('new');
  });

  it('gỡ liên kết: đặt employeeId null và giải phóng nhân viên', async () => {
    const previous = emp({ userId: 'u1' });
    repo.findOne.mockResolvedValue(previous);
    const u = user({ employeeId: 'e1' });
    const result = await service.apply(manager, u, null);
    expect(result).toBeNull();
    expect(u.employeeId).toBeNull();
    expect(previous.userId).toBeNull();
  });
});
