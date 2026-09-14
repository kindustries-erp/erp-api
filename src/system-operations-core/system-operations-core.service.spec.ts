import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  SystemOperationsCoreService,
  StartOperationOptions,
} from './system-operations-core.service';
import { ErpSystemOperation } from './entities/erp_system_operation.entity';

describe('SystemOperationsCoreService', () => {
  let service: SystemOperationsCoreService;
  let repo: any;
  let qb: any;
  let dataSource: any;

  beforeEach(async () => {
    qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
      getMany: jest.fn(),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      execute: jest.fn(),
    };

    repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };

    dataSource = {
      transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SystemOperationsCoreService,
        {
          provide: getRepositoryToken(ErpSystemOperation),
          useValue: repo,
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
      ],
    }).compile();

    service = module.get<SystemOperationsCoreService>(
      SystemOperationsCoreService,
    );
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  describe('getActiveOperations & In-Memory Micro-Cache', () => {
    it('should query DB on first call and cache result', async () => {
      const mockOps = [
        {
          id: 'op-1',
          module: 'INVENTORY',
          operationType: 'GOODS_RECEIPT_POST',
          status: 'PROCESSING',
          isBlockingUi: true,
        },
      ];
      qb.getMany.mockResolvedValue(mockOps);

      // First call -> Hits DB
      const res1 = await service.getActiveOperations({ module: 'INVENTORY' });
      expect(res1).toEqual(mockOps);
      expect(repo.createQueryBuilder).toHaveBeenCalledTimes(1);

      // Second call immediately -> Hits In-Memory Cache (0 DB queries)
      const res2 = await service.getActiveOperations({ module: 'INVENTORY' });
      expect(res2).toEqual(mockOps);
      expect(repo.createQueryBuilder).toHaveBeenCalledTimes(1);
    });

    it('should query DB again after cache is invalidated', async () => {
      const mockOps = [{ id: 'op-1', status: 'PROCESSING' }];
      qb.getMany.mockResolvedValue(mockOps);

      await service.getActiveOperations({ module: 'INVENTORY' });
      expect(repo.createQueryBuilder).toHaveBeenCalledTimes(1);

      // Invalidate cache
      service.invalidateCache();

      // Call again -> Hits DB
      await service.getActiveOperations({ module: 'INVENTORY' });
      expect(repo.createQueryBuilder).toHaveBeenCalledTimes(2);
    });
  });

  describe('startOperation', () => {
    it('should throw ConflictException if conflicting active operation exists', async () => {
      qb.getOne.mockResolvedValue({
        id: 'existing-op',
        userName: 'Admin',
        targetNo: 'NK-001',
      });

      const options: StartOperationOptions = {
        module: 'INVENTORY',
        operationType: 'GOODS_RECEIPT_POST',
        targetId: 'doc-1',
      };

      await expect(service.startOperation(options)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should create operation, bust cache and emit START event when no conflict', async () => {
      qb.getOne.mockResolvedValue(null);
      const createdOp = {
        id: 'new-op-uuid',
        module: 'INVENTORY',
        operationType: 'GOODS_RECEIPT_POST',
        status: 'PROCESSING',
        isBlockingUi: true,
      };
      repo.create.mockReturnValue(createdOp);
      repo.save.mockResolvedValue(createdOp);

      let emittedEvent: any = null;
      service.stream$.subscribe((event) => {
        emittedEvent = event;
      });

      const result = await service.startOperation({
        module: 'INVENTORY',
        operationType: 'GOODS_RECEIPT_POST',
      });

      expect(result).toEqual(createdOp);
      expect(repo.save).toHaveBeenCalled();
      expect(emittedEvent).toEqual({
        event: 'START',
        data: createdOp,
      });
    });
  });

  describe('updateProgress', () => {
    it('should update progressData, bust cache and emit PROGRESS event', async () => {
      const op = {
        id: 'op-1',
        status: 'PROCESSING',
        progressData: { percent: 10 },
      };
      repo.findOneBy.mockResolvedValue(op);
      repo.save.mockResolvedValue({
        ...op,
        progressData: { percent: 50 },
      });

      let emittedEvent: any = null;
      service.stream$.subscribe((event) => {
        emittedEvent = event;
      });

      const result = await service.updateProgress('op-1', { percent: 50 });
      expect(result.progressData).toEqual({ percent: 50 });
      expect(emittedEvent.event).toBe('PROGRESS');
    });

    it('should throw NotFoundException if operation not found or not processing', async () => {
      repo.findOneBy.mockResolvedValue(null);
      await expect(
        service.updateProgress('non-existent', { percent: 50 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('completeOperation', () => {
    it('should mark status COMPLETED, bust cache and emit COMPLETE event', async () => {
      const op = {
        id: 'op-1',
        module: 'INVENTORY',
        operationType: 'GOODS_RECEIPT_POST',
        status: 'PROCESSING',
      };
      repo.findOneBy.mockResolvedValue(op);
      repo.save.mockResolvedValue({ ...op, status: 'COMPLETED' });

      let emittedEvent: any = null;
      service.stream$.subscribe((event) => {
        emittedEvent = event;
      });

      const result = await service.completeOperation('op-1');
      expect(result.status).toBe('COMPLETED');
      expect(emittedEvent.event).toBe('COMPLETE');
    });
  });

  describe('failOperation', () => {
    it('should mark status FAILED, record error, bust cache and emit FAIL event', async () => {
      const op = {
        id: 'op-1',
        module: 'INVENTORY',
        operationType: 'GOODS_RECEIPT_POST',
        status: 'PROCESSING',
      };
      repo.findOneBy.mockResolvedValue(op);
      repo.save.mockResolvedValue({
        ...op,
        status: 'FAILED',
        metadata: { error: 'Database timeout' },
      });

      let emittedEvent: any = null;
      service.stream$.subscribe((event) => {
        emittedEvent = event;
      });

      const result = await service.failOperation('op-1', 'Database timeout');
      expect(result.status).toBe('FAILED');
      expect(emittedEvent.event).toBe('FAIL');
    });
  });

  describe('checkActionBlocked', () => {
    it('should return isBlocked: false when no active operations', async () => {
      qb.getMany.mockResolvedValue([]);
      const check = await service.checkActionBlocked('INVENTORY');
      expect(check.isBlocked).toBe(false);
      expect(check.lock).toBeNull();
    });

    it('should return isBlocked: true when module is locked', async () => {
      qb.getMany.mockResolvedValue([
        {
          id: 'op-1',
          module: 'INVENTORY',
          operationType: 'GOODS_RECEIPT_POST',
          scopeType: 'MODULE',
          isBlockingUi: true,
          userName: 'Thủ kho 1',
        },
      ]);

      const check = await service.checkActionBlocked(
        'INVENTORY',
        'CREATE_RECEIPT',
      );
      expect(check.isBlocked).toBe(true);
      expect(check.lock).toBeDefined();
      expect(check.reason).toContain('Thủ kho 1');
    });
  });
});
