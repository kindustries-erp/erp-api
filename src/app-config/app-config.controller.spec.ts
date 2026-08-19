import { Test, TestingModule } from '@nestjs/testing';
import { AppConfigController } from './app-config.controller';
import { AppConfigService } from './app-config.service';

describe('AppConfigController', () => {
  let controller: AppConfigController;
  let service: {
    getPublicConfig: jest.Mock;
    getUserPreferences: jest.Mock;
    updateUserPreferences: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      getPublicConfig: jest.fn().mockReturnValue({
        appEnv: 'greenway-staging',
        appName: 'Liouni ERP',
        version: '1.0.0',
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
      appName: 'Liouni ERP',
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
});
