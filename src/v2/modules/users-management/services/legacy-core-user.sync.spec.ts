import { IsNull } from 'typeorm';
import type { EntityManager } from 'typeorm';
import { CoreRefreshToken } from '@/auth/entities/core-refresh-token.entity';
import { CoreUser } from '@/users/entities/core-user.entity';
import type { UsersManagement } from '../entities/users-management.entity';
import {
  legacyEmailExists,
  pullFromLegacyCoreUsers,
  revokeLegacyRefreshTokens,
  syncToLegacyCoreUser,
} from './legacy-core-user.sync';

describe('legacy-core-user.sync', () => {
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

  describe('pullFromLegacyCoreUsers', () => {
    it('có userId: khóa hàng core_users trước, rồi chèn tài khoản thiếu, rồi cập nhật tài khoản lệch', async () => {
      await pullFromLegacyCoreUsers(manager, 'u1');

      expect(query).toHaveBeenCalledTimes(3);
      expect(query.mock.calls[0][0]).toContain('FOR UPDATE');
      expect(query.mock.calls[0][1]).toEqual(['u1']);
      expect(query.mock.calls[1][0]).toContain(
        'INSERT INTO "users_management"',
      );
      expect(query.mock.calls[2][0]).toContain('UPDATE "users_management"');
      expect(query.mock.calls[1][1]).toEqual(['u1']);
      expect(query.mock.calls[2][1]).toEqual(['u1']);
    });

    it('không có userId: không khóa, quét toàn bảng (tham số null)', async () => {
      await pullFromLegacyCoreUsers(manager);

      expect(query).toHaveBeenCalledTimes(2);
      expect(
        query.mock.calls.some(([sql]) => String(sql).includes('FOR UPDATE')),
      ).toBe(false);
      expect(query.mock.calls[0][1]).toEqual([null]);
    });

    it('core_users là nguồn đúng cho mật khẩu và mốc đăng nhập do v1 ghi', async () => {
      await pullFromLegacyCoreUsers(manager);
      const update = String(query.mock.calls[1][0]);
      expect(update).toContain('"password_hash" = cu."password_hash"');
      expect(update).toContain('"last_login_at" = cu."last_login_at"');
      expect(update).toContain(
        '"password_changed_at" = cu."password_changed_at"',
      );
    });

    it('đọc timestamp cũ theo UTC cố định, không theo session', async () => {
      await pullFromLegacyCoreUsers(manager);
      const insert = String(query.mock.calls[0][0]);
      expect(insert).toContain(`AT TIME ZONE 'UTC'`);
      expect(insert).not.toContain('current_setting');
    });

    it('giữ giá trị cũ thay vì vi phạm unique khi email hoặc nhân viên bị trùng', async () => {
      await pullFromLegacyCoreUsers(manager);
      const update = String(query.mock.calls[1][0]);
      expect(update).toContain('o."email" = lower(trim(cu."email"))');
      expect(update).toContain('o."employee_id" = cu."employee_id"');
    });
  });

  it('syncToLegacyCoreUser ghi đủ trường sang core_users với cùng id', async () => {
    await syncToLegacyCoreUser(manager, {
      id: 'u1',
      email: 'a@b.co',
      passwordHash: 'h',
      status: 'ACTIVE',
      employeeId: null,
      legacyDirectusUserId: null,
      lastLoginAt: null,
      createdBy: null,
      passwordChangedAt: null,
    } as UsersManagement);
    expect(coreUserRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'u1', email: 'a@b.co', passwordHash: 'h' }),
    );
  });

  it('legacyEmailExists so khớp không phân biệt hoa thường', async () => {
    query.mockResolvedValueOnce([{}]);
    await expect(legacyEmailExists(manager, 'a@b.co')).resolves.toBe(true);
    expect(String(query.mock.calls[0][0])).toContain('lower(trim("email"))');
    query.mockResolvedValueOnce([]);
    await expect(legacyEmailExists(manager, 'x@b.co')).resolves.toBe(false);
  });

  it('revokeLegacyRefreshTokens chỉ thu hồi token chưa bị thu hồi của đúng user', async () => {
    await revokeLegacyRefreshTokens(manager, 'u1');
    expect(tokenRepo.update).toHaveBeenCalledWith(
      { userId: 'u1', revokedAt: IsNull() },
      { revokedAt: expect.any(Date) },
    );
    expect(CoreRefreshToken).toBeDefined();
  });
});
