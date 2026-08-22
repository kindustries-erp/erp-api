import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditCoreService } from './audit-core.service';
import { ErpAuditLog } from './entities/erp-audit-log.entity';

describe('AuditCoreService', () => {
  let service: AuditCoreService;
  let mockRepository: any;

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditCoreService,
        {
          provide: getRepositoryToken(ErpAuditLog),
          useValue: mockRepository,
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
