import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RbacCoreService } from './rbac-core.service';
import { CoreRole } from './entities/core-role.entity';
import { CorePermission } from './entities/core-permission.entity';
import { CoreUserRole } from './entities/core-user-role.entity';

describe('RbacCoreService', () => {
  let service: RbacCoreService;
  let roleRepo: any;
  let permissionRepo: any;
  let userRoleRepo: any;

  beforeEach(async () => {
    roleRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    permissionRepo = {
      find: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    };

    userRoleRepo = {
      find: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RbacCoreService,
        { provide: getRepositoryToken(CoreRole), useValue: roleRepo },
        {
          provide: getRepositoryToken(CorePermission),
          useValue: permissionRepo,
        },
        { provide: getRepositoryToken(CoreUserRole), useValue: userRoleRepo },
      ],
    }).compile();

    service = module.get<RbacCoreService>(RbacCoreService);
  });

  describe('hasPermission', () => {
    it('should return true when user has exact resource:action permission', async () => {
      userRoleRepo.find.mockResolvedValue([
        {
          userId: 'user-1',
          role: {
            isActive: true,
            permissions: [{ resource: 'garage', action: 'read' }],
          },
        },
      ]);

      const result = await service.hasPermission('user-1', 'garage', 'read');
      expect(result).toBe(true);
    });

    it('should return true when user has wildcard resource or wildcard action', async () => {
      userRoleRepo.find.mockResolvedValue([
        {
          userId: 'user-admin',
          role: {
            isActive: true,
            permissions: [{ resource: '*', action: '*' }],
          },
        },
      ]);

      const result = await service.hasPermission(
        'user-admin',
        'garage',
        'create',
      );
      expect(result).toBe(true);
    });

    it('should return false when user only has legacy resource (greenway_integration/kgara_integration)', async () => {
      userRoleRepo.find.mockResolvedValue([
        {
          userId: 'user-legacy',
          role: {
            isActive: true,
            permissions: [
              { resource: 'greenway_integration', action: 'read' },
              { resource: 'kgara_integration', action: 'read' },
            ],
          },
        },
      ]);

      const result = await service.hasPermission(
        'user-legacy',
        'garage',
        'read',
      );
      expect(result).toBe(false);
    });

    it('should return false when user has no permissions matching the action', async () => {
      userRoleRepo.find.mockResolvedValue([
        {
          userId: 'user-view-only',
          role: {
            isActive: true,
            permissions: [{ resource: 'garage', action: 'read' }],
          },
        },
      ]);

      const result = await service.hasPermission(
        'user-view-only',
        'garage',
        'delete',
      );
      expect(result).toBe(false);
    });
  });

  describe('getAvailableResources', () => {
    it('should list "garage" and exclude legacy "greenway_integration" and "kgara_integration"', async () => {
      const resources = await service.getAvailableResources();
      const resourceKeys = resources.map((r) => r.resource);

      expect(resourceKeys).toContain('garage');
      expect(resourceKeys).not.toContain('greenway_integration');
      expect(resourceKeys).not.toContain('kgara_integration');
    });
  });
});
