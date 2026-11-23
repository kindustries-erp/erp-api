import { IsNull } from 'typeorm';
import type { EntityManager } from 'typeorm';
import { CoreUser } from '@/users/entities/core-user.entity';
import type { UsersManagement } from '../entities/users-management.entity';
import {
  revokeAllUserSessions,
  syncToLegacyCoreUser,
} from './legacy-core-user.sync';

describe('legacy-core-user.sync (bản sao một chiều sang core_users)', () => {
  let query: jest.Mock;
  let coreUserRepo: { save: jest.Mock };
  let tokenRepo: { update: jest.Mock };
  let manager: EntityManager;

  beforeEach(() => {
    query = jest.fn().mockResolvedValue([]);
    coreUserRepo = { save: jest.fn().mockResolvedValue(undefined) };
    tokenRepo = { update: jest.fn().mockResolvedValue(undefined) };
    manager = {
      query,
      getRepository: (entity: unknown) =>
        entity === CoreUser ? coreUserRepo : tokenRepo,
    } as unknown as EntityManager;
  });

  it('syncToLegacyCoreUser ghi đủ trường sang core_users, giữ nguyên id', async () => {
    await syncToLegacyCoreUser(manager, {
      id: 'u1',
      email: 'a@b.co',
      passwordHash: 'h',
      status: 'ACTIVE',
      employeeId: null,
      lastLoginAt: null,
      createdBy: null,
      passwordChangedAt: null,
    } as UsersManagement);
    expect(coreUserRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'u1', email: 'a@b.co', passwordHash: 'h' }),
    );
  });

  it('không đọc hay kéo dữ liệu từ core_users (users_management là nguồn chính)', async () => {
    await syncToLegacyCoreUser(manager, { id: 'u1' } as UsersManagement);
    expect(query).not.toHaveBeenCalled();
  });

  it('revokeAllUserSessions thu hồi cả refresh token v1 lẫn session v2 của đúng user', async () => {
    await revokeAllUserSessions(manager, 'u1');
    expect(tokenRepo.update).toHaveBeenCalledWith(
      { userId: 'u1', revokedAt: IsNull() },
      { revokedAt: expect.any(Date) },
    );
    expect(String(query.mock.calls[0][0])).toContain('"auth_sessions"');
    expect(String(query.mock.calls[0][0])).toContain('"revoked_at" IS NULL');
    expect(query.mock.calls[0][1]).toEqual(['u1']);
  });
});
