import { AiHubUsageLog } from '../entities/ai-hub-usage-log.entity';
import { toAiHubUsageLogResponse } from './ai-hub-usage-log.mapper';

describe('toAiHubUsageLogResponse', () => {
  it('trả response DTO, không lộ isDeleted và điền 0 cho số thiếu', () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const entity = {
      id: 'id-1',
      isDeleted: false,
      extraData: { fileName: 'hd.pdf' },
      featureCode: 'GARAGE_PR_INVOICE',
      tier: 'low',
      modelName: 'm-low',
      totalTokens: 12,
      outcome: 'SUCCESS',
      createdAt,
      updatedAt: createdAt,
    } as unknown as AiHubUsageLog;

    const dto = toAiHubUsageLogResponse(entity);

    expect(dto).not.toHaveProperty('isDeleted');
    expect(dto).toMatchObject({
      id: 'id-1',
      tier: 'low',
      modelName: 'm-low',
      promptTokens: 0,
      totalTokens: 12,
      extraData: { fileName: 'hd.pdf' },
    });
  });
});
