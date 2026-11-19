import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  isKgaraDeadlockBody,
  KGARA_DEADLOCK_MAX_RETRIES,
  KgaraClientService,
} from './kgara-client.service';
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

  describe('deadlock retry', () => {
    const DEADLOCK_BODY = {
      status: 500,
      message:
        'Internal Server Error: Transaction (Process ID 242) was deadlocked on lock resources with another process and has been chosen as the deadlock victim. Rerun the transaction.',
      data: null,
    };
    const okResponse = (body: unknown) =>
      ({ ok: true, status: 200, json: () => Promise.resolve(body) }) as any;

    beforeEach(() => {
      jest.spyOn(service as any, 'sleep').mockResolvedValue(undefined);
    });

    it('isKgaraDeadlockBody chỉ nhận status 500 có thông báo deadlock', () => {
      expect(isKgaraDeadlockBody(DEADLOCK_BODY)).toBe(true);
      expect(
        isKgaraDeadlockBody({ status: 500, message: 'Thiếu thông chi nhánh!' }),
      ).toBe(false);
      expect(isKgaraDeadlockBody({ status: 200, message: 'deadlock' })).toBe(
        false,
      );
      expect(isKgaraDeadlockBody(null)).toBe(false);
    });

    it('thử lại khi gặp deadlock rồi trả dữ liệu khi thành công', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(okResponse(DEADLOCK_BODY))
        .mockResolvedValueOnce(okResponse(DEADLOCK_BODY))
        .mockResolvedValueOnce(
          okResponse({ status: 200, message: 'Ok', data: { id: 'c1' } }),
        );

      const result = await service.getCaseDetail('c1', 'branch-1');

      expect(result.data).toEqual({ id: 'c1' });
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('ném lỗi nêu rõ deadlock khi hết lượt thử lại', async () => {
      (global.fetch as jest.Mock).mockResolvedValue(okResponse(DEADLOCK_BODY));

      await expect(service.getCaseDetail('c1', 'branch-1')).rejects.toThrow(
        /deadlock sau 3 lần thử lại/,
      );
      expect(global.fetch).toHaveBeenCalledTimes(
        KGARA_DEADLOCK_MAX_RETRIES + 1,
      );
    });

    it('không thử lại với phản hồi thành công hoặc lỗi nghiệp vụ khác', async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        okResponse({
          status: 500,
          message: 'Thiếu thông chi nhánh!',
          data: null,
        }),
      );

      const result = await service.getCaseDetail('c1', 'branch-1');

      expect(result.message).toBe('Thiếu thông chi nhánh!');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });
});
