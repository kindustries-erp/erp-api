import { IsNull } from 'typeorm';
import { hashToken } from '@/v2/core/auth-core';
import { LegacyRefreshTokenExchange } from './legacy-refresh-token.exchange';

describe('LegacyRefreshTokenExchange', () => {
  const rec = (over: Record<string, unknown> = {}) => ({
    id: 'r1',
    userId: 'u1',
    userAgent: 'ua',
    ipAddress: 'ip',
    revokedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    ...over,
  });
  let repo: { findOne: jest.Mock; update: jest.Mock };
  let ex: LegacyRefreshTokenExchange;

  beforeEach(() => {
    repo = {
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    ex = new LegacyRefreshTokenExchange(repo as never);
  });

  it('đổi token hợp lệ: thu hồi có điều kiện và trả thông tin phiên', async () => {
    repo.findOne.mockResolvedValue(rec());
    await expect(ex.exchange('raw')).resolves.toEqual({
      userId: 'u1',
      userAgent: 'ua',
      ipAddress: 'ip',
    });
    expect(repo.findOne).toHaveBeenCalledWith({
      where: { tokenHash: hashToken('raw') },
    });
    expect(repo.update).toHaveBeenCalledWith(
      { id: 'r1', revokedAt: IsNull() },
      { revokedAt: expect.any(Date) },
    );
  });

  it.each([
    ['không tồn tại', null],
    ['đã thu hồi', rec({ revokedAt: new Date() })],
    ['hết hạn', rec({ expiresAt: new Date(Date.now() - 1) })],
  ])('%s: null, không thu hồi', async (_n, value) => {
    repo.findOne.mockResolvedValue(value);
    await expect(ex.exchange('raw')).resolves.toBeNull();
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('đua request: bên thua (affected = 0) nhận null', async () => {
    repo.findOne.mockResolvedValue(rec());
    repo.update.mockResolvedValue({ affected: 0 });
    await expect(ex.exchange('raw')).resolves.toBeNull();
  });
});
