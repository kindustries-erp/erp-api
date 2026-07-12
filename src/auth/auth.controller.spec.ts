import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    login: jest.Mock;
    registerLocalUser: jest.Mock;
    profile: jest.Mock;
  };

  beforeEach(async () => {
    authService = {
      login: jest.fn(),
      registerLocalUser: jest.fn(),
      profile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe('login', () => {
    it('should delegate login(email, password) to AuthService', async () => {
      const loginResult = {
        accessToken: 'token-1',
        tokenType: 'Bearer',
        user: { id: 'u1', email: 'test@example.com', status: 'ACTIVE' },
      };
      authService.login.mockResolvedValue(loginResult);

      const req = { headers: {}, ip: '127.0.0.1' } as any;

      const result = await controller.login(
        {
          email: 'test@example.com',
          password: 'password123',
        },
        req,
      );

      expect(result).toEqual(loginResult);
      expect(authService.login).toHaveBeenCalledWith(
        'test@example.com',
        'password123',
        { userAgent: undefined, ipAddress: '127.0.0.1' },
      );
    });
  });

  describe('register', () => {
    it('should delegate register body to AuthService.registerLocalUser', async () => {
      const payload = {
        email: 'new@example.com',
        password: 'StrongPass123',
        employeeId: 'emp-1',
      };
      const registerResult = {
        id: 'u2',
        email: payload.email,
        employeeId: payload.employeeId,
      };
      authService.registerLocalUser.mockResolvedValue(registerResult);

      const result = await controller.register(payload);

      expect(result).toEqual(registerResult);
      expect(authService.registerLocalUser).toHaveBeenCalledWith(payload);
    });
  });

  describe('profile', () => {
    it('should delegate request.user.sub to AuthService.profile', async () => {
      const req = { user: { sub: 'user-1' } } as any;
      const profileResult = {
        id: 'user-1',
        email: 'user@example.com',
        status: 'ACTIVE',
        employee: null,
      };
      authService.profile.mockResolvedValue(profileResult);

      const result = await controller.profile(req);

      expect(result).toEqual(profileResult);
      expect(authService.profile).toHaveBeenCalledWith('user-1');
    });
  });
});
