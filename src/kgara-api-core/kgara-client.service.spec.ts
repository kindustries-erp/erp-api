import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { KgaraClientService } from './kgara-client.service';
import { KgaraAuthService } from './kgara-auth.service';
import { KgaraAccountKey } from './enums/kgara-account.enum';

describe('KgaraClientService (Multi-Account Routing)', () => {
  let service: KgaraClientService;
  let authService: any;
  let configService: any;

  beforeEach(async () => {
    authService = {
      getValidToken: jest.fn().mockImplementation((acc) => {
        if (acc === KgaraAccountKey.OJ) return Promise.resolve('token-oj');
        return Promise.resolve('token-main');
      }),
      getCredentials: jest.fn().mockImplementation((acc) => {
        if (acc === KgaraAccountKey.OJ) {
          return {
            host: 'greenwayapi.kgara.com',
            username: 'apidongbo',
            password: 'pass',
            makhachhang: 'greenwaycn2',
          };
        }
        return {
          host: 'greenwayapi.kgara.com',
          username: 'apidongbo',
          password: 'pass',
          makhachhang: 'greenwayauto',
        };
      }),
      forceRefreshToken: jest.fn().mockResolvedValue('token-refreshed'),
      getLastError: jest.fn().mockReturnValue(null),
    };

    configService = {
      get: jest.fn().mockReturnValue('greenwayapi.kgara.com'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KgaraClientService,
        { provide: KgaraAuthService, useValue: authService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<KgaraClientService>(KgaraClientService);

    // Mock global fetch
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, data: [] }),
    } as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('requests with MAIN account by default', async () => {
    await service.getBranches();
    expect(authService.getValidToken).toHaveBeenCalledWith(
      KgaraAccountKey.MAIN,
    );
    expect(global.fetch).toHaveBeenCalledWith(
      'https://greenwayapi.kgara.com/api/v1/donvi/list',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer token-main',
        }),
      }),
    );
  });

  it('requests with OJ account when specified', async () => {
    await service.getBranches(KgaraAccountKey.OJ);
    expect(authService.getValidToken).toHaveBeenCalledWith(KgaraAccountKey.OJ);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://greenwayapi.kgara.com/api/v1/donvi/list',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer token-oj',
        }),
      }),
    );
  });

  it('passes accountKey when fetching cases', async () => {
    await service.getCases(
      'branch-oj-1',
      '2026-10-01',
      '2026-10-31',
      undefined,
      1,
      200,
      KgaraAccountKey.OJ,
    );
    expect(authService.getValidToken).toHaveBeenCalledWith(KgaraAccountKey.OJ);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/gr/cases/list'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer token-oj',
          SS_ClientID: 'branch-oj-1',
        }),
      }),
    );
  });
});
