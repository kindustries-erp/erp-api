import { AbstractAuthSessionService } from '@/v2/core/auth-core';
import { SessionTokenService } from './session-token.service';
import type { Repository } from 'typeorm';
import type { AuthSession } from '../entities/auth-session.entity';

describe('SessionTokenService', () => {
  it('kế thừa vòng đời phiên từ lõi và phát hành token chỉ lưu hash', async () => {
    const save = jest.fn((v: unknown) => Promise.resolve(v));
    const repo = {
      create: (v: unknown) => v,
      save,
    } as unknown as Repository<AuthSession>;
    const service = new SessionTokenService(repo);
    expect(service).toBeInstanceOf(AbstractAuthSessionService);
    const raw = await service.issue('u1');
    expect(raw).toMatch(/^[0-9a-f]{96}$/);
    expect((save.mock.calls[0][0] as AuthSession).tokenHash).not.toBe(raw);
  });
});
