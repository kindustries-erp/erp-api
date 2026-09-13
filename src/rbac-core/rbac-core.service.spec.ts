import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  RbacCoreService,
  CoreRole,
  CorePermission,
  CoreUserRole,
  ErpResource,
  ErpAction,
} from '@/rbac-core';

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

    it('should support ErpResource and ErpAction enums', async () => {
      userRoleRepo.find.mockResolvedValue([
        {
          userId: 'user-bank',
          role: {
            isActive: true,
            permissions: [
              { resource: ErpResource.BANK_STATEMENTS, action: ErpAction.READ },
            ],
          },
        },
      ]);

      const result = await service.hasPermission(
        'user-bank',
        ErpResource.BANK_STATEMENTS,
        ErpAction.READ,
      );
      expect(result).toBe(true);
    });
  });

  describe('hasAnyPermission', () => {
    it('should return true if user has at least one of the required permissions', async () => {
      userRoleRepo.find.mockResolvedValue([
        {
          userId: 'user-cash',
          role: {
            isActive: true,
            permissions: [
              { resource: ErpResource.CASH_STATEMENTS, action: ErpAction.READ },
            ],
          },
        },
      ]);

      const result = await service.hasAnyPermission('user-cash', [
        { resource: ErpResource.BANK_STATEMENTS, action: ErpAction.READ },
        { resource: ErpResource.CASH_STATEMENTS, action: ErpAction.READ },
      ]);
      expect(result).toBe(true);
    });

    it('should return false if user has none of the required permissions', async () => {
      userRoleRepo.find.mockResolvedValue([
        {
          userId: 'user-sales',
          role: {
            isActive: true,
            permissions: [
              { resource: ErpResource.SALES_ORDERS, action: ErpAction.READ },
            ],
          },
        },
      ]);

      const result = await service.hasAnyPermission('user-sales', [
        { resource: ErpResource.BANK_STATEMENTS, action: ErpAction.READ },
        { resource: ErpResource.CASH_STATEMENTS, action: ErpAction.READ },
      ]);
      expect(result).toBe(false);
    });

    it('should return true if required permissions list is empty', async () => {
      const result = await service.hasAnyPermission('user-1', []);
      expect(result).toBe(true);
    });
  });

  describe('hasAllPermissions', () => {
    it('should return true if user has all of the required permissions', async () => {
      userRoleRepo.find.mockResolvedValue([
        {
          userId: 'user-accountant',
          role: {
            isActive: true,
            permissions: [
              { resource: ErpResource.BANK_STATEMENTS, action: ErpAction.READ },
              { resource: ErpResource.CASH_STATEMENTS, action: ErpAction.READ },
            ],
          },
        },
      ]);

      const result = await service.hasAllPermissions('user-accountant', [
        { resource: ErpResource.BANK_STATEMENTS, action: ErpAction.READ },
        { resource: ErpResource.CASH_STATEMENTS, action: ErpAction.READ },
      ]);
      expect(result).toBe(true);
    });

    it('should return false if user only has some but not all required permissions', async () => {
      userRoleRepo.find.mockResolvedValue([
        {
          userId: 'user-bank-only',
          role: {
            isActive: true,
            permissions: [
              { resource: ErpResource.BANK_STATEMENTS, action: ErpAction.READ },
            ],
          },
        },
      ]);

      const result = await service.hasAllPermissions('user-bank-only', [
        { resource: ErpResource.BANK_STATEMENTS, action: ErpAction.READ },
        { resource: ErpResource.CASH_STATEMENTS, action: ErpAction.READ },
      ]);
      expect(result).toBe(false);
    });
  });

  describe('getAvailableResources', () => {
    it('should list "garage", "bank_statements", "cash_statements" and exclude legacy resources', async () => {
      const resources = await service.getAvailableResources();
      const resourceKeys = resources.map((r) => r.resource);

      expect(resourceKeys).toContain('garage');
      expect(resourceKeys).toContain('bank_statements');
      expect(resourceKeys).toContain('cash_statements');
      expect(resourceKeys).not.toContain('cash_funds');
      expect(resourceKeys).not.toContain('bank_accounts');
      expect(resourceKeys).not.toContain('greenway_integration');
      expect(resourceKeys).not.toContain('kgara_integration');
    });
  });
});
