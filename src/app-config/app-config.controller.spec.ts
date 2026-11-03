import { Test, TestingModule } from '@nestjs/testing';
import { AppConfigController } from './app-config.controller';
import { AppConfigService } from './app-config.service';

describe('AppConfigController', () => {
  let controller: AppConfigController;
  let service: {
    getPublicConfig: jest.Mock;
    getUserPreferences: jest.Mock;
    updateUserPreferences: jest.Mock;
    getTablePreferences: jest.Mock;
    updateTablePreference: jest.Mock;
    getChangelog: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      getPublicConfig: jest.fn().mockReturnValue({
        appEnv: 'greenway-staging',
        appName: 'ERP',
        version: '1.0.0',
      }),
      getChangelog: jest.fn().mockReturnValue({
        items: [],
        meta: {
          page: 1,
          limit: 6,
          total: 0,
          totalPages: 1,
          hasNextPage: false,
        },
      }),
      getUserPreferences: jest.fn().mockResolvedValue({
        id: 'pref-1',
        userId: 'user-1',
        theme: 'classic',
        language: 'vi',
        tableConfigs: {},
        uiConfigs: {},
      }),
      updateUserPreferences: jest.fn().mockResolvedValue({
        id: 'pref-1',
        userId: 'user-1',
        theme: 'midnight',
        language: 'en',
        tableConfigs: { 'orders-table': { columnOrder: ['id'] } },
        uiConfigs: {},
      }),
      getTablePreferences: jest.fn().mockResolvedValue({
        'business-partners': { columns: {}, views: {} },
      }),
      updateTablePreference: jest
        .fn()
        .mockImplementation((_u, tableId, dto) =>
          Promise.resolve({ tableId, columns: dto.columns, views: dto.views }),
        ),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppConfigController],
      providers: [
        {
          provide: AppConfigService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<AppConfigController>(AppConfigController);
  });

  it('should return public config without auth', () => {
    const result = controller.getPublicConfig();
    expect(result).toEqual({
      appEnv: 'greenway-staging',
      appName: 'ERP',
      version: '1.0.0',
    });
    expect(service.getPublicConfig).toHaveBeenCalled();
  });

  it('should return user preferences for logged in user', async () => {
    const req = { user: { sub: 'user-1' } } as any;
    const result = await controller.getUserPreferences(req);
    expect(result.data.userId).toBe('user-1');
    expect(service.getUserPreferences).toHaveBeenCalledWith('user-1');
  });

  it('should update user preferences for logged in user', async () => {
    const req = { user: { sub: 'user-1' } } as any;
    const dto = {
      theme: 'midnight',
      language: 'en',
      tableConfigs: { 'orders-table': { columnOrder: ['id'] } },
    };
    const result = await controller.updateUserPreferences(dto, req);
    expect(result.data.theme).toBe('midnight');
    expect(service.updateUserPreferences).toHaveBeenCalledWith('user-1', dto);
  });

  it('should return table preferences for logged in user', async () => {
    const req = { user: { sub: 'user-1' } } as any;
    const result = await controller.getTablePreferences(req);
    expect(result.data).toEqual({
      'business-partners': { columns: {}, views: {} },
    });
    expect(service.getTablePreferences).toHaveBeenCalledWith('user-1');
  });

  it('should update one table preference for logged in user', async () => {
    const req = { user: { sub: 'user-1' } } as any;
    const dto = { columns: { order: ['code'] } };
    const result = await controller.updateTablePreference(
      'business-partners',
      dto,
      req,
    );
    expect(result.data.tableId).toBe('business-partners');
    expect(service.updateTablePreference).toHaveBeenCalledWith(
      'user-1',
      'business-partners',
      dto,
    );
  });

  it('should return paginated changelog without auth', () => {
    service.getChangelog = jest.fn().mockReturnValue({
      items: [{ version: 'v2026.08.22' }],
      meta: { page: 1, limit: 6, total: 1, totalPages: 1, hasNextPage: false },
    });
    const query = { page: 1, limit: 6, search: 'Garage' };
    const result = controller.getChangelog(query);
    expect(result.items.length).toBe(1);
    expect(service.getChangelog).toHaveBeenCalledWith(query);
  });
});
