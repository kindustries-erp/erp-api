import { toSafeUser } from './users-admin.mapper';

describe('toSafeUser', () => {
  const user = {
    id: 'u1',
    email: 'a@x.com',
    status: 'ACTIVE',
    employeeId: 'e1',
    legacyDirectusUserId: null,
    lastLoginAt: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
    passwordHash: 'SECRET',
  } as never;

  it('không lộ passwordHash, lastLoginAt mặc định null, employee null khi không có', () => {
    const res = toSafeUser(user);
    expect(JSON.stringify(res)).not.toContain('SECRET');
    expect(res.lastLoginAt).toBeNull();
    expect(res.employee).toBeNull();
  });

  it('gộp tóm tắt nhân viên', () => {
    const res = toSafeUser(user, {
      id: 'e1',
      fullName: 'An',
      employeeCode: 'NV1',
      email: null,
      phone: '09',
      status: 'ACTIVE',
    } as never);
    expect(res.employee).toMatchObject({ id: 'e1', employeeCode: 'NV1' });
  });
});
