import type { EmployeeManagement } from '@/v2/modules/employees-management/entities/employee-management.entity';
import { UsersManagement } from '../entities/users-management.entity';
import { toUserResponse } from './user.mapper';

const makeUser = (over: Partial<UsersManagement> = {}): UsersManagement =>
  ({
    id: 'u1',
    email: 'a@b.co',
    passwordHash: 'SECRET-HASH',
    status: 'ACTIVE',
    employeeId: null,
    legacyDirectusUserId: null,
    lastLoginAt: null,
    passwordChangedAt: null,
    createdBy: null,
    extraData: undefined,
    isDeleted: false,
    createdAt: new Date('2026-11-15T00:00:00.000Z'),
    updatedAt: new Date('2026-11-15T00:00:00.000Z'),
    ...over,
  }) as unknown as UsersManagement;

describe('toUserResponse', () => {
  it('không lộ passwordHash và extraData mặc định là object', () => {
    const res = toUserResponse(makeUser());
    expect(JSON.stringify(res)).not.toContain('SECRET-HASH');
    expect(res).not.toHaveProperty('passwordHash');
    expect(res.extraData).toEqual({});
    expect(res.employee).toBeNull();
  });

  it('thời gian giữ nguyên kiểu Date (serialize ISO UTC)', () => {
    const res = toUserResponse(makeUser());
    expect(res.createdAt.toISOString()).toBe('2026-11-15T00:00:00.000Z');
  });

  it('gắn tóm tắt nhân viên khi có', () => {
    const employee = {
      id: 'e1',
      fullName: 'Nguyen A',
      employeeCode: 'NV01',
      email: null,
      phone: '090',
      status: 'ACTIVE',
    } as unknown as EmployeeManagement;
    const res = toUserResponse(makeUser({ employeeId: 'e1' }), employee);
    expect(res.employee).toEqual({
      id: 'e1',
      fullName: 'Nguyen A',
      employeeCode: 'NV01',
      email: undefined,
      phone: '090',
      status: 'ACTIVE',
    });
  });
});
