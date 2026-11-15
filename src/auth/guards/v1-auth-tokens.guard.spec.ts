import { ExecutionContext, GoneException } from '@nestjs/common';
import {
  ENABLE_V1_AUTH_TOKENS_ENV,
  V1AuthTokensGuard,
} from './v1-auth-tokens.guard';

describe('V1AuthTokensGuard', () => {
  const guard = new V1AuthTokensGuard();
  const original = process.env[ENABLE_V1_AUTH_TOKENS_ENV];
  const context = {
    switchToHttp: () => ({
      getRequest: () => ({
        method: 'POST',
        path: '/api/v1/auth/login',
        headers: { 'user-agent': 'jest' },
      }),
    }),
  } as unknown as ExecutionContext;

  afterEach(() => {
    if (original === undefined) delete process.env[ENABLE_V1_AUTH_TOKENS_ENV];
    else process.env[ENABLE_V1_AUTH_TOKENS_ENV] = original;
  });

  it('mặc định (không đặt biến) trả 410 Gone', () => {
    delete process.env[ENABLE_V1_AUTH_TOKENS_ENV];
    expect(() => guard.canActivate(context)).toThrow(GoneException);
  });

  it.each(['false', '', '1', 'TRUE'])('giá trị "%s" vẫn tắt', (value) => {
    process.env[ENABLE_V1_AUTH_TOKENS_ENV] = value;
    expect(() => guard.canActivate(context)).toThrow(GoneException);
  });

  it('ENABLE_V1_AUTH_TOKENS=true bật lại V1', () => {
    process.env[ENABLE_V1_AUTH_TOKENS_ENV] = 'true';
    expect(guard.canActivate(context)).toBe(true);
  });
});
