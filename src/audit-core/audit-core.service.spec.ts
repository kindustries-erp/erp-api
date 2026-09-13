import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditCoreService } from './audit-core.service';
import { ErpAuditLog } from './entities/erp-audit-log.entity';

describe('AuditCoreService', () => {
  let service: AuditCoreService;
  let mockRepository: any;
  let mockConfigService: any;

  beforeEach(async () => {
    mockRepository = {
      createQueryBuilder: jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        into: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({}),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      }),
      find: jest.fn().mockResolvedValue([]),
    };

    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'ENABLE_AUDIT_LOG') return 'true';
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditCoreService,
        {
          provide: getRepositoryToken(ErpAuditLog),
          useValue: mockRepository,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AuditCoreService>(AuditCoreService);
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(service.isEnabled).toBe(true);
  });

  it('buffers logs in memory without immediately calling execute', async () => {
    service.recordAction({
      actionType: 'CREATE',
      module: 'users',
      actorEmail: 'test@liouni.com',
      afterSnapshot: { password: 'secretPassword', name: 'User 1' },
    });

    // In buffer, not yet flushed
    expect(mockRepository.createQueryBuilder().execute).not.toHaveBeenCalled();

    // Flush manually
    await service.flush();

    expect(mockRepository.createQueryBuilder().execute).toHaveBeenCalled();
  });

  it('does not buffer or flush logs when ENABLE_AUDIT_LOG is false', async () => {
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'ENABLE_AUDIT_LOG') return 'false';
      return undefined;
    });

    expect(service.isEnabled).toBe(false);

    service.recordAction({
      actionType: 'CREATE',
      module: 'users',
      actorEmail: 'disabled@liouni.com',
    });

    await service.flush();

    expect(mockRepository.createQueryBuilder().execute).not.toHaveBeenCalled();

    const findAllRes = await service.findAll({});
    expect(findAllRes).toEqual({ data: [], total: 0, page: 1, pageSize: 20 });

    const timelineRes = await service.getEntityTimeline('user', '123');
    expect(timelineRes).toEqual([]);
  });

  it('builds diff between before and after snapshots accurately', () => {
    const before = { status: 'PENDING', amount: 100, note: 'old note' };
    const after = { status: 'APPROVED', amount: 100, note: 'new note' };

    const diff = service.buildDiff(before, after);

    expect(diff).toEqual({
      status: { before: 'PENDING', after: 'APPROVED' },
      note: { before: 'old note', after: 'new note' },
    });
  });
});
