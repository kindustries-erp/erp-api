import { NotFoundException } from '@nestjs/common';
import { AiHubUsageLog } from './entities/ai-hub-usage-log.entity';
import { QueryAiHubUsageLogDto } from './dto/query-ai-hub-usage-log.dto';
import { AiGatewayHealthService } from './services/ai-gateway-health.service';
import { AiHubUsageLogQueryService } from './services/ai-hub-usage-log-query.service';
import { AiHubGatewayService } from './ai-hub-gateway.service';

describe('AiHubGatewayService', () => {
  const createdAt = new Date('2026-01-01T00:00:00.000Z');
  const row = {
    id: 'id-1',
    isDeleted: false,
    createdAt,
    updatedAt: createdAt,
  } as AiHubUsageLog;

  let query: {
    findAll: jest.Mock;
    findById: jest.Mock;
    findColumnOptions: jest.Mock;
  };
  let health: { check: jest.Mock };
  let service: AiHubGatewayService;

  beforeEach(() => {
    query = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findColumnOptions: jest.fn(),
    };
    health = { check: jest.fn() };
    service = new AiHubGatewayService(
      query as unknown as AiHubUsageLogQueryService,
      health as unknown as AiGatewayHealthService,
    );
  });

  it('trả chi tiết dạng message/data, không lộ isDeleted', async () => {
    query.findById.mockResolvedValue(row);

    const result = await service.findOne('id-1');

    expect(result.data.id).toBe('id-1');
    expect(result.data).not.toHaveProperty('isDeleted');
  });

  it('ném NotFound khi không có dòng', async () => {
    query.findById.mockResolvedValue(null);

    await expect(service.findOne('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('map danh sách sang response DTO kèm pagination', async () => {
    query.findAll.mockResolvedValue({
      items: [row],
      total: 41,
      page: 1,
      pageSize: 20,
      summaries: {},
    });

    const result = await service.findAll({} as QueryAiHubUsageLogDto);

    expect(result.pagination).toMatchObject({ total: 41, totalPages: 3 });
    expect(result.items[0]).not.toHaveProperty('isDeleted');
  });

  it('chuyển health và column options xuống service con', async () => {
    health.check.mockResolvedValue({ ok: true });
    await expect(service.health()).resolves.toEqual({ ok: true });

    await service.findColumnOptions('tier', 'l', 1, 20, '{}');
    expect(query.findColumnOptions).toHaveBeenCalledWith(
      'tier',
      'l',
      1,
      20,
      '{}',
    );
  });
});
