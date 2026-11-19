import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { KgaraAuthService } from './kgara-auth.service';
import { KgaraAuth } from './entities/kgara_auth.entity';
import { KgaraAccountKey } from './enums/kgara-account.enum';

describe('KgaraAuthService (Multi-Account)', () => {
  let service: KgaraAuthService;
  let authRepo: any;
  let configService: any;

  beforeEach(async () => {
    authRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    };

    configService = {
      get: jest.fn((key: string) => {
        const configMap: Record<string, string> = {
          KGARA_API_HOST: 'greenwayapi.kgara.com',
          KGARA_MA_KHACH_HANG: 'test-main-customer',
          KGARA_USERNAME: 'test-main-user',
          KGARA_PASSWORD: 'test-main-password',
          KGARA_MA_KHACH_HANG_2: 'test-oj-customer',
          KGARA_USERNAME_2: 'test-oj-user',
          KGARA_PASSWORD_2: 'test-oj-password',
        };
        return configMap[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KgaraAuthService,
        {
          provide: getRepositoryToken(KgaraAuth),
          useValue: authRepo,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    service = module.get<KgaraAuthService>(KgaraAuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getCredentials', () => {
    it('resolves MAIN credentials from KGARA_USERNAME / KGARA_PASSWORD / KGARA_MA_KHACH_HANG', () => {
      const creds = service.getCredentials(KgaraAccountKey.MAIN);
      expect(creds).toEqual({
        host: 'greenwayapi.kgara.com',
        username: 'test-main-user',
        password: 'test-main-password',
        makhachhang: 'test-main-customer',
      });
    });

    it('resolves OJ credentials from *_2 env vars', () => {
      const creds = service.getCredentials(KgaraAccountKey.OJ);
      expect(creds).toEqual({
        host: 'greenwayapi.kgara.com',
        username: 'test-oj-user',
        password: 'test-oj-password',
        makhachhang: 'test-oj-customer',
      });
    });

    it('returns null for OJ when *_2 env vars are missing', () => {
      configService.get.mockImplementation((key: string) =>
        key.endsWith('_2') ? undefined : 'x',
      );
      expect(service.getCredentials(KgaraAccountKey.OJ)).toBeNull();
    });
  });

  describe('getConfiguredAccounts', () => {
    it('returns both accounts when both credential sets are configured', () => {
      expect(service.getConfiguredAccounts()).toEqual([
        KgaraAccountKey.MAIN,
        KgaraAccountKey.OJ,
      ]);
    });

    it('omits OJ when *_2 env vars are missing', () => {
      configService.get.mockImplementation((key: string) => {
        if (key.endsWith('_2')) return undefined;
        return key === 'KGARA_API_HOST' ? 'greenwayapi.kgara.com' : 'x';
      });
      expect(service.getConfiguredAccounts()).toEqual([KgaraAccountKey.MAIN]);
    });
  });

  describe('getLastError', () => {
    it('records HTTP status when OJ login is rejected', async () => {
      authRepo.findOne.mockResolvedValue(undefined);
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      } as any);

      const token = await service.getValidToken(KgaraAccountKey.OJ);

      expect(token).toBeNull();
      expect(service.getLastError(KgaraAccountKey.OJ)).toContain('HTTP 401');
      expect(service.getLastError(KgaraAccountKey.MAIN)).toBeNull();
    });
  });

  describe('refresh token hết hạn (KGara trả 200 kèm body status 401)', () => {
    const okJson = (body: unknown) =>
      ({ ok: true, status: 200, json: () => Promise.resolve(body) }) as any;
    const expired = {
      accountKey: KgaraAccountKey.OJ,
      accessToken: 'old',
      refreshToken: 'stale-refresh',
      tokenExpires: new Date(Date.now() - 60 * 1000),
    };

    it('chuyển sang đăng nhập lại thay vì ghi Invalid Date', async () => {
      authRepo.findOne.mockResolvedValue({ ...expired });
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(
          okJson({
            status: 401,
            message: 'Refresh token không hợp lệ!',
            data: null,
          }),
        )
        .mockResolvedValueOnce(
          okJson({
            AccessToken: 'new-access',
            RefreshToken: 'new-refresh',
            TokenExpires: '2099-01-01 10:00:00',
            SS_ClientID: 'c1',
          }),
        );

      const token = await service.getValidToken(KgaraAccountKey.OJ);

      expect(token).toBe('new-access');
      expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain(
        '/auth/refresh-token',
      );
      expect((global.fetch as jest.Mock).mock.calls[1][0]).toContain(
        '/auth/login',
      );
      const saved = authRepo.save.mock.calls[0][0];
      expect(saved.tokenExpires.getTime()).not.toBeNaN();
      expect(saved.refreshToken).toBe('new-refresh');
    });

    it('đăng nhập bị từ chối bằng HTTP 200 kèm body lỗi thì lastError nêu đúng lý do', async () => {
      authRepo.findOne.mockResolvedValue(undefined);
      global.fetch = jest
        .fn()
        .mockResolvedValue(okJson({ status: 401, message: 'Sai mật khẩu' }));

      const token = await service.getValidToken(KgaraAccountKey.OJ);

      expect(token).toBeNull();
      expect(authRepo.save).not.toHaveBeenCalled();
      expect(service.getLastError(KgaraAccountKey.OJ)).toContain(
        'Sai mật khẩu',
      );
    });

    it('đăng nhập trả TokenExpires không hợp lệ thì báo lỗi rõ ràng, không ghi DB', async () => {
      authRepo.findOne.mockResolvedValue(undefined);
      global.fetch = jest
        .fn()
        .mockResolvedValue(okJson({ AccessToken: 'a', TokenExpires: 'rác' }));

      const token = await service.getValidToken(KgaraAccountKey.OJ);

      expect(token).toBeNull();
      expect(authRepo.save).not.toHaveBeenCalled();
      expect(service.getLastError(KgaraAccountKey.OJ)).toContain(
        'token không hợp lệ',
      );
    });
  });

  describe('getValidToken', () => {
    it('returns valid cached token when not expired for MAIN', async () => {
      const futureDate = new Date(Date.now() + 60 * 60 * 1000);
      authRepo.findOne.mockResolvedValue({
        accountKey: KgaraAccountKey.MAIN,
        accessToken: 'token-main-123',
        tokenExpires: futureDate,
      });

      const token = await service.getValidToken(KgaraAccountKey.MAIN);
      expect(token).toBe('token-main-123');
      expect(authRepo.findOne).toHaveBeenCalledWith({
        where: { accountKey: KgaraAccountKey.MAIN },
        order: { createdAt: 'DESC' },
      });
    });

    it('returns valid cached token for OJ independently of MAIN', async () => {
      const futureDate = new Date(Date.now() + 60 * 60 * 1000);
      authRepo.findOne.mockResolvedValue({
        accountKey: KgaraAccountKey.OJ,
        accessToken: 'token-oj-456',
        tokenExpires: futureDate,
      });

      const token = await service.getValidToken(KgaraAccountKey.OJ);
      expect(token).toBe('token-oj-456');
      expect(authRepo.findOne).toHaveBeenCalledWith({
        where: { accountKey: KgaraAccountKey.OJ },
        order: { createdAt: 'DESC' },
      });
    });
  });
});
