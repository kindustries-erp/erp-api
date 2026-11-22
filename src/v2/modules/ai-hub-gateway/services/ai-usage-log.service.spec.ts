import { Repository } from 'typeorm';
import { AiHubUsageLog } from '../entities/ai-hub-usage-log.entity';
import { AiUsageLogService } from './ai-usage-log.service';

describe('AiUsageLogService', () => {
  const input = {
    featureCode: 'F',
    tier: 'low',
    modelName: 'm-low',
    outcome: 'SUCCESS' as const,
    latencyMs: 12.6,
    meta: { fileName: 'a.png' },
  };

  it('ghi một dòng, điền 0 cho token thiếu và đưa meta vào extraData', async () => {
    const repo = {
      create: jest.fn((value: object) => value),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const service = new AiUsageLogService(
      repo as unknown as Repository<AiHubUsageLog>,
    );

    await service.record(input);

    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        featureCode: 'F',
        latencyMs: 13,
        totalTokens: 0,
        extraData: { fileName: 'a.png' },
        isDeleted: false,
      }),
    );
  });

  it('không ném lỗi khi DB hỏng', async () => {
    const repo = {
      create: jest.fn((value: object) => value),
      save: jest.fn().mockRejectedValue(new Error('db')),
    };
    const service = new AiUsageLogService(
      repo as unknown as Repository<AiHubUsageLog>,
    );
    jest.spyOn(service['logger'], 'error').mockImplementation();

    await expect(service.record(input)).resolves.toBeUndefined();
  });
});
