import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { AppConfigService } from './app-config.service';
import { CoreUserPreference } from '../users/entities/core-user-preference.entity';

describe('AppConfigService', () => {
  let service: AppConfigService;
  let repo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let configService: {
    get: jest.Mock;
  };

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((val) => val),
      save: jest.fn().mockImplementation((val) => Promise.resolve(val)),
    };

    configService = {
      get: jest.fn().mockReturnValue('greenway-staging'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppConfigService,
        {
          provide: getRepositoryToken(CoreUserPreference),
          useValue: repo,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    service = module.get<AppConfigService>(AppConfigService);
  });

  it('getPublicConfig should return appEnv from config service', () => {
    const result = service.getPublicConfig();
    expect(result).toEqual({
      appEnv: 'greenway-staging',
      appName: 'Liouni ERP',
      version: '1.0.0',
    });
  });

  it('getUserPreferences should return existing preference', async () => {
    const existing = {
      id: 'p1',
      userId: 'u1',
      theme: 'classic',
      language: 'vi',
      tableConfigs: {},
      uiConfigs: {},
    };
    repo.findOne.mockResolvedValue(existing);

    const result = await service.getUserPreferences('u1');
    expect(result).toBe(existing);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('getUserPreferences should create default preference if not exists', async () => {
    repo.findOne.mockResolvedValue(null);

    const result = await service.getUserPreferences('u2');
    expect(repo.create).toHaveBeenCalledWith({
      userId: 'u2',
      theme: 'classic',
      language: 'vi',
      tableConfigs: {},
      uiConfigs: {},
    });
    expect(result.userId).toBe('u2');
  });

  it('updateUserPreferences should deep merge tableConfigs and update fields', async () => {
    const existing = {
      id: 'p1',
      userId: 'u1',
      theme: 'classic',
      language: 'vi',
      tableConfigs: { 'table-a': { col: 1 } },
      uiConfigs: { sidebar: true },
    };
    repo.findOne.mockResolvedValue(existing);

    const result = await service.updateUserPreferences('u1', {
      theme: 'midnight',
      language: 'en',
      tableConfigs: { 'table-b': { col: 2 } },
    });

    expect(result.theme).toBe('midnight');
    expect(result.language).toBe('en');
    expect(result.tableConfigs).toEqual({
      'table-a': { col: 1 },
      'table-b': { col: 2 },
    });
    expect(result.uiConfigs).toEqual({ sidebar: true });
    expect(repo.save).toHaveBeenCalled();
  });
});
