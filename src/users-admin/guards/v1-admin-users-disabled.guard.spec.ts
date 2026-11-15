import { GoneException } from '@nestjs/common';
import {
  ENABLE_V1_ADMIN_USERS_ENV,
  V1AdminUsersDisabledGuard,
} from './v1-admin-users-disabled.guard';

describe('V1AdminUsersDisabledGuard', () => {
  const guard = new V1AdminUsersDisabledGuard();
  const original = process.env[ENABLE_V1_ADMIN_USERS_ENV];

  afterEach(() => {
    if (original === undefined) delete process.env[ENABLE_V1_ADMIN_USERS_ENV];
    else process.env[ENABLE_V1_ADMIN_USERS_ENV] = original;
  });

  it('mặc định (không đặt biến) trả 410 Gone', () => {
    delete process.env[ENABLE_V1_ADMIN_USERS_ENV];
    expect(() => guard.canActivate()).toThrow(GoneException);
  });

  it.each(['false', '', '1', 'TRUE'])('giá trị "%s" vẫn tắt', (value) => {
    process.env[ENABLE_V1_ADMIN_USERS_ENV] = value;
    expect(() => guard.canActivate()).toThrow(GoneException);
  });

  it('ENABLE_V1_ADMIN_USERS=true bật lại V1', () => {
    process.env[ENABLE_V1_ADMIN_USERS_ENV] = 'true';
    expect(guard.canActivate()).toBe(true);
  });
});
