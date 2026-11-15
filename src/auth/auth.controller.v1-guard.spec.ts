import { AuthController } from './auth.controller';
import { V1AuthTokensGuard } from './guards/v1-auth-tokens.guard';

const guardsOf = (handler: unknown): unknown[] =>
  Reflect.getMetadata('__guards__', handler as object) ?? [];

describe('AuthController: guard V1 phát token', () => {
  const proto = AuthController.prototype;

  it.each(['login', 'refresh', 'impersonate'] as const)(
    '%s có V1AuthTokensGuard',
    (name) => {
      expect(guardsOf(proto[name])).toContain(V1AuthTokensGuard);
    },
  );

  it.each(['logout', 'changePassword', 'profile', 'updateProfile'] as const)(
    '%s không bị V1AuthTokensGuard chặn',
    (name) => {
      expect(guardsOf(proto[name])).not.toContain(V1AuthTokensGuard);
    },
  );
});
