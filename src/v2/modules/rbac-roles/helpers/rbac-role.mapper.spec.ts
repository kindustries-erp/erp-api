import { describe, expect, it } from '@jest/globals';
import { toRoleUser, toRoleListItem } from './rbac-role.mapper';

describe('rbac-role.mapper', () => {
  it('toRoleUser chỉ giữ id và email, không lộ password_hash', () => {
    const user = { id: 'u1', email: 'a@b.c', passwordHash: 'SECRET' } as any;
    expect(toRoleUser(user)).toEqual({ id: 'u1', email: 'a@b.c' });
  });

  it('toRoleListItem đổi isActive thành is_active và map users', () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    const item = toRoleListItem({
      id: 'r1',
      name: 'Kế toán',
      description: null,
      isActive: false,
      createdAt,
      userRoles: [{ user: { id: 'u1', email: 'a@b.c', passwordHash: 'x' } }],
    } as any);
    expect(item).toEqual({
      id: 'r1',
      name: 'Kế toán',
      description: null,
      is_active: false,
      createdAt,
      users: [{ id: 'u1', email: 'a@b.c' }],
    });
  });

  it('toRoleListItem không lỗi khi role chưa có userRoles', () => {
    const item = toRoleListItem({
      id: 'r2',
      name: 'X',
      isActive: true,
      createdAt: new Date(),
    } as any);
    expect(item.users).toEqual([]);
  });
});
