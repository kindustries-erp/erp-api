import { AiHubGatewayService } from '../ai-hub-gateway.service';
import { QueryAiHubUsageLogDto } from '../dto/query-ai-hub-usage-log.dto';
import { AiHubUsageLogController } from './ai-hub-usage-log.controller';

describe('AiHubUsageLogController', () => {
  let service: {
    health: jest.Mock;
    findAll: jest.Mock;
    findColumnOptions: jest.Mock;
    findOne: jest.Mock;
  };
  let controller: AiHubUsageLogController;

  beforeEach(() => {
    service = {
      health: jest.fn(),
      findAll: jest.fn(),
      findColumnOptions: jest.fn(),
      findOne: jest.fn(),
    };
    controller = new AiHubUsageLogController(
      service as unknown as AiHubGatewayService,
    );
  });

  it('chuyển health, list và chi tiết xuống facade', async () => {
    const query = {} as QueryAiHubUsageLogDto;

    await controller.health();
    await controller.findAll(query);
    await controller.findOne('id-1');

    expect(service.health).toHaveBeenCalled();
    expect(service.findAll).toHaveBeenCalledWith(query);
    expect(service.findOne).toHaveBeenCalledWith('id-1');
  });

  it('ép kiểu và giới hạn phân trang của column options', async () => {
    await controller.columnOptions('tier', 'l', '2', '999', '{}');

    expect(service.findColumnOptions).toHaveBeenCalledWith(
      'tier',
      'l',
      2,
      200,
      '{}',
    );
  });

  it('không có API ghi', () => {
    expect(controller).not.toHaveProperty('create');
    expect(controller).not.toHaveProperty('update');
    expect(controller).not.toHaveProperty('remove');
  });
});
