import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { AppConfigService } from './app-config.service';
import { CoreUserPreference } from '../users/entities/core-user-preference.entity';
import { CoreUserTablePreference } from '../users/entities/core-user-table-preference.entity';

describe('AppConfigService', () => {
  let service: AppConfigService;
  let repo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let tablePreferenceRepo: {
    find: jest.Mock;
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

    tablePreferenceRepo = {
      find: jest.fn().mockResolvedValue([]),
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
          provide: getRepositoryToken(CoreUserTablePreference),
          useValue: tablePreferenceRepo,
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
      appName: 'ERP',
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

  describe('getTablePreferences', () => {
    it('should return a map keyed by tableId with columns and views', async () => {
      tablePreferenceRepo.find.mockResolvedValue([
        {
          userId: 'u1',
          tableId: 'business-partners',
          columns: { visibility: { notes: false }, order: ['code'] },
          views: { customViews: [], activeKey: 'all' },
        },
      ]);

      const result = await service.getTablePreferences('u1');

      expect(tablePreferenceRepo.find).toHaveBeenCalledWith({
        where: { userId: 'u1' },
      });
      expect(result).toEqual({
        'business-partners': {
          columns: { visibility: { notes: false }, order: ['code'] },
          views: { customViews: [], activeKey: 'all' },
        },
      });
    });

    it('should return an empty map when the user has no table preferences', async () => {
      await expect(service.getTablePreferences('u1')).resolves.toEqual({});
    });
  });

  describe('updateTablePreference', () => {
    it('should create a new row when none exists for the table', async () => {
      tablePreferenceRepo.findOne.mockResolvedValue(null);

      const result = await service.updateTablePreference('u1', 'invoices', {
        columns: { order: ['no'] },
      });

      expect(tablePreferenceRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u1', tableId: 'invoices' }),
      );
      expect(tablePreferenceRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'u1',
          tableId: 'invoices',
          columns: { order: ['no'] },
        }),
      );
      expect(result).toEqual({
        tableId: 'invoices',
        columns: { order: ['no'] },
        views: {},
      });
    });

    it('should replace only the part that was sent and keep the other', async () => {
      tablePreferenceRepo.findOne.mockResolvedValue({
        userId: 'u1',
        tableId: 'invoices',
        columns: { order: ['a'] },
        views: { activeKey: 'old' },
      });

      const result = await service.updateTablePreference('u1', 'invoices', {
        views: { activeKey: 'new' },
      });

      expect(result.columns).toEqual({ order: ['a'] });
      expect(result.views).toEqual({ activeKey: 'new' });
      expect(tablePreferenceRepo.save).toHaveBeenCalled();
    });

    it('should reject an empty or overlong tableId', async () => {
      await expect(service.updateTablePreference('u1', '', {})).rejects.toThrow(
        'tableId không hợp lệ',
      );
      await expect(
        service.updateTablePreference('u1', 'x'.repeat(201), {}),
      ).rejects.toThrow('tableId không hợp lệ');
      expect(tablePreferenceRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('getChangelog', () => {
    it('should return paginated releases with default page and limit', () => {
      const result = service.getChangelog({});
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(6);
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.meta.total).toBeGreaterThan(0);
    });

    it('should filter releases by keyword case-insensitively', () => {
      const result = service.getChangelog({ search: 'garage' });
      expect(result.items.length).toBeGreaterThan(0);
      expect(
        result.items.every(
          (r) =>
            r.version.toLowerCase().includes('garage') ||
            r.tag?.toLowerCase().includes('garage') ||
            r.titleVi.toLowerCase().includes('garage') ||
            r.titleEn.toLowerCase().includes('garage') ||
            r.items.some(
              (it) =>
                it.textVi.toLowerCase().includes('garage') ||
                it.textEn.toLowerCase().includes('garage'),
            ),
        ),
      ).toBe(true);
    });
  });
});
