import { IsNull } from 'typeorm';
import type { Repository } from 'typeorm';
import { BaseAuthSessionEntity } from '../entities/base-auth-session.entity';
import { hashToken } from '../helpers/token.helper';
import { AbstractAuthSessionService } from './abstract-auth-session.service';

class TestSession extends BaseAuthSessionEntity {}
class TestService extends AbstractAuthSessionService<TestSession> {
  constructor(repo: Repository<TestSession>) {
    super(repo);
  }
}

const session = (over: Partial<TestSession> = {}): TestSession =>
  Object.assign(new TestSession(), {
    id: 's1',
    userId: 'u1',
    tokenHash: 'h',
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null,
    userAgent: 'ua',
    ipAddress: '1.1.1.1',
    isDeleted: false,
    ...over,
  });

describe('AbstractAuthSessionService', () => {
  let repo: Record<string, jest.Mock>;
  let service: TestService;

  beforeEach(() => {
    repo = {
      create: jest.fn((v: unknown) => v),
      save: jest.fn((v: unknown) => Promise.resolve(v)),
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      delete: jest.fn().mockResolvedValue({ affected: 3 }),
    };
    service = new TestService(repo as unknown as Repository<TestSession>);
  });

  it('issue chỉ lưu hash, trả token thô, hạn 30 ngày và ghi meta', async () => {
    const raw = await service.issue('u1', { userAgent: 'ua', ipAddress: 'ip' });
    const saved = repo.save.mock.calls[0][0] as TestSession;
    expect(saved.tokenHash).toBe(hashToken(raw));
    expect(saved.tokenHash).not.toBe(raw);
    expect(saved.userAgent).toBe('ua');
    const days = (saved.expiresAt.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThanOrEqual(30);
  });

  describe('findValid', () => {
    it('trả phiên còn hạn và chưa thu hồi', async () => {
      repo.findOne.mockResolvedValue(session());
      await expect(service.findValid('raw')).resolves.toMatchObject({
        id: 's1',
      });
      expect(repo.findOne.mock.calls[0][0].where).toEqual({
        tokenHash: hashToken('raw'),
        isDeleted: false,
      });
    });

    it('không có phiên: null', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findValid('raw')).resolves.toBeNull();
    });

    it('token đã thu hồi bị dùng lại: thu hồi mọi phiên của user và trả null', async () => {
      repo.findOne.mockResolvedValue(session({ revokedAt: new Date() }));
      await expect(service.findValid('raw')).resolves.toBeNull();
      expect(repo.update).toHaveBeenCalledWith(
        { userId: 'u1', revokedAt: IsNull() },
        { revokedAt: expect.any(Date) },
      );
    });

    it('hết hạn: null, không thu hồi hàng loạt', async () => {
      repo.findOne.mockResolvedValue(
        session({ expiresAt: new Date(Date.now() - 1000) }),
      );
      await expect(service.findValid('raw')).resolves.toBeNull();
      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  describe('rotate', () => {
    it('thu hồi phiên cũ có điều kiện và phát hành token mới cùng meta', async () => {
      repo.findOne.mockResolvedValue(session());
      const res = await service.rotate('raw');
      expect(res?.refreshToken).toMatch(/^[0-9a-f]{96}$/);
      expect(repo.update).toHaveBeenCalledWith(
        { id: 's1', revokedAt: IsNull() },
        { revokedAt: expect.any(Date) },
      );
      const created = repo.save.mock.calls[0][0] as TestSession;
      expect(created.userAgent).toBe('ua');
      expect(created.ipAddress).toBe('1.1.1.1');
    });

    it('đua request: thu hồi không ảnh hưởng dòng nào thì trả null và không cấp token mới', async () => {
      repo.findOne.mockResolvedValue(session());
      repo.update.mockResolvedValue({ affected: 0 });
      await expect(service.rotate('raw')).resolves.toBeNull();
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('token không hợp lệ: null', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.rotate('raw')).resolves.toBeNull();
    });
  });

  it('revoke chỉ thu hồi đúng token chưa bị thu hồi', async () => {
    await service.revoke('raw');
    expect(repo.update).toHaveBeenCalledWith(
      { tokenHash: hashToken('raw'), revokedAt: IsNull() },
      { revokedAt: expect.any(Date) },
    );
  });

  it('purgeExpiredBefore trả số dòng đã xóa', async () => {
    await expect(service.purgeExpiredBefore(new Date())).resolves.toBe(3);
  });
});
