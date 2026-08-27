import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditRetentionScheduler } from './audit-retention.scheduler';
import { ErpAuditLog } from '../entities/erp-audit-log.entity';

describe('AuditRetentionScheduler', () => {
  let scheduler: AuditRetentionScheduler;
  let mockRepository: any;
  let mockConfigService: any;

  beforeEach(async () => {
    mockRepository = {
      query: jest.fn().mockResolvedValue([[], 0]),
    };

    mockConfigService = {
      get: jest.fn().mockReturnValue('30'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditRetentionScheduler,
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

    scheduler = module.get<AuditRetentionScheduler>(AuditRetentionScheduler);
  });

  it('should be defined', () => {
    expect(scheduler).toBeDefined();
  });

  it('runs retention cleanup and queries database with retention days', async () => {
    mockRepository.query
      .mockResolvedValueOnce([[], 2000]) // Batch 1
      .mockResolvedValueOnce([[], 150]); // Batch 2 (end)

    const total = await scheduler.handleRetentionCleanup();

    expect(total).toBe(2150);
    expect(mockRepository.query).toHaveBeenCalledTimes(2);
    expect(mockRepository.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM erp_audit_logs'),
      [30, 2000],
    );
  });
});
