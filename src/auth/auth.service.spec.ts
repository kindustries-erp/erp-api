import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: {
    findByEmail: jest.Mock;
    findById: jest.Mock;
    createSeedUserIfMissing: jest.Mock;
    verifyPassword: jest.Mock;
    registerLocalUser: jest.Mock;
    getEmployeeSnapshot: jest.Mock;
  };
  let jwtService: { signAsync: jest.Mock };

  beforeEach(async () => {
    usersService = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      createSeedUserIfMissing: jest.fn().mockResolvedValue(undefined),
      verifyPassword: jest.fn(),
      registerLocalUser: jest.fn(),
      getEmployeeSnapshot: jest.fn().mockResolvedValue(null),
    };

    jwtService = {
      signAsync: jest.fn().mockResolvedValue('mocked-access-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(undefined),
            getOrThrow: jest.fn().mockReturnValue('mock'),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('login', () => {
    it('should return accessToken and user on valid credentials', async () => {
      const mockUser = {
        id: 'u1',
        email: 'test@example.com',
        passwordHash: 'hashed',
        status: 'ACTIVE',
        employeeId: null,
        legacyDirectusUserId: null,
      };
      usersService.findByEmail.mockResolvedValue(mockUser);
      usersService.verifyPassword.mockReturnValue(true);

      const result = await service.login('test@example.com', 'password123');

      expect(result.accessToken).toBe('mocked-access-token');
      expect(result.tokenType).toBe('Bearer');
      expect(result.user.email).toBe('test@example.com');
      expect(usersService.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(usersService.verifyPassword).toHaveBeenCalledWith(
        'password123',
        'hashed',
      );
    });

    it('should throw UnauthorizedException on invalid credentials', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.login('bad@example.com', 'wrongpass'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException on wrong password', async () => {
      const mockUser = {
        id: 'u1',
        email: 'test@example.com',
        passwordHash: 'hashed',
        status: 'ACTIVE',
        employeeId: null,
        legacyDirectusUserId: null,
      };
      usersService.findByEmail.mockResolvedValue(mockUser);
      usersService.verifyPassword.mockReturnValue(false);

      await expect(
        service.login('test@example.com', 'wrongpass'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('registerLocalUser', () => {
    it('should delegate to usersService.registerLocalUser', async () => {
      const payload = {
        email: 'new@example.com',
        password: 'pass1234',
        employeeId: 'emp-1',
      };
      const created = { id: 'u2', email: payload.email };
      usersService.registerLocalUser.mockResolvedValue(created);

      const result = await service.registerLocalUser(payload);

      expect(result).toEqual(created);
      expect(usersService.registerLocalUser).toHaveBeenCalledWith(payload);
    });
  });

  describe('profile', () => {
    it('should return user profile with null employee when no employee linked', async () => {
      const mockUser = {
        id: 'u1',
        email: 'test@example.com',
        status: 'ACTIVE',
        employeeId: null,
        legacyDirectusUserId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      usersService.findById.mockResolvedValue(mockUser);
      usersService.getEmployeeSnapshot.mockResolvedValue(null);

      const result = await service.profile('u1');

      expect(result.id).toBe('u1');
      expect(result.email).toBe('test@example.com');
      expect(result.employee).toBeNull();
    });

    it('should throw UnauthorizedException when user not found', async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(service.profile('not-exist')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
