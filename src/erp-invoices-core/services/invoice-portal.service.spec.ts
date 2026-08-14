import { InvoicePortalService } from './invoice-portal.service';
import { CompanyProfile } from '../../company-profile/entities/company-profile.entity';
import { safeDecrypt } from '../../common/utils/encrypt.util';

describe('InvoicePortalService - Auth & Auto Re-login', () => {
  let service: InvoicePortalService;
  let mockInvoiceRepo: any;
  let mockCompanyProfileRepo: any;
  let mockBranchRepo: any;
  let mockR2Service: any;
  let mockNotificationsService: any;
  let mockLifecycleService: any;
  let mockVinfastPartsService: any;

  let storedProfile: Partial<CompanyProfile> | null = null;

  beforeEach(() => {
    storedProfile = {
      id: 'profile-uuid',
      company_name: 'Test Company',
      tax_code: '0318334886',
      gdt_portal_token: 'old_expired_token',
      gdt_portal_cookies: 'TS0114b13e=oldcookie',
      gdt_portal_username: '0318334886',
      gdt_portal_password: '', // will be set in tests
    };

    mockCompanyProfileRepo = {
      findOne: jest
        .fn()
        .mockImplementation(() => Promise.resolve(storedProfile)),
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockImplementation((profile) => {
        storedProfile = { ...storedProfile, ...profile };
        return Promise.resolve(storedProfile);
      }),
    };

    mockInvoiceRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      findByIds: jest.fn(),
    };

    mockBranchRepo = {
      findOne: jest.fn(),
    };

    mockR2Service = {
      uploadBuffer: jest.fn(),
    };

    mockNotificationsService = {
      createForUser: jest.fn(),
    };

    mockLifecycleService = {
      findOne: jest.fn(),
      update: jest.fn(),
    };

    mockVinfastPartsService = {
      syncCatalog: jest.fn(),
      syncLedger: jest.fn(),
    };

    service = new InvoicePortalService(
      mockInvoiceRepo,
      mockCompanyProfileRepo,
      mockBranchRepo,
      mockR2Service,
      mockNotificationsService,
      mockLifecycleService,
      mockVinfastPartsService,
    );
  });

  describe('Password encryption & getPortalConfig security', () => {
    it('savePortalConfig should encrypt password before storing in DB', async () => {
      const plainPassword = 'MySecretTaxPassword123!';
      await service.savePortalConfig(
        'new_token_123',
        'new_cookies_456',
        '0318334886',
        plainPassword,
      );

      expect(storedProfile?.gdt_portal_password).toBeDefined();
      expect(storedProfile?.gdt_portal_password).not.toEqual(plainPassword);
      expect(storedProfile?.gdt_portal_password?.startsWith('enc:')).toBe(true);

      // Decrypted password should match original
      const decrypted = safeDecrypt(storedProfile?.gdt_portal_password);
      expect(decrypted).toEqual(plainPassword);
    });

    it('getPortalConfig should NOT expose plain password and return hasPassword: true', async () => {
      await service.savePortalConfig(
        'token_abc',
        'cookies_def',
        '0318334886',
        'secret_pass',
      );

      const publicConfig = await service.getPortalConfig();
      expect((publicConfig as any).password).toBeUndefined();
      expect(publicConfig.hasPassword).toBe(true);
      expect(publicConfig.username).toEqual('0318334886');
      expect(publicConfig.token).toEqual('token_abc');
    });

    it('getInternalPortalConfig should decrypt stored password for internal backend use', async () => {
      const plainPass = 'InternalPass!999';
      await service.savePortalConfig(
        'token_1',
        'cookies_1',
        '0318334886',
        plainPass,
      );

      const internalConfig = await service.getInternalPortalConfig();
      expect(internalConfig.password).toEqual(plainPass);
      expect(internalConfig.username).toEqual('0318334886');
    });
  });

  describe('autoReloginWithRetry', () => {
    it('should return null if no credentials exist in database', async () => {
      storedProfile = {
        gdt_portal_username: '',
        gdt_portal_password: '',
      };

      const result = await service.autoReloginWithRetry(3, 10);
      expect(result).toBeNull();
    });

    it('should successfully solve captcha and login on attempt 1', async () => {
      await service.savePortalConfig(
        'old_token',
        'old_cookies',
        '0318334886',
        'valid_pass_123',
      );

      // Mock getCaptcha
      jest.spyOn(service, 'getCaptcha').mockResolvedValue({
        content: '<svg>...</svg>',
        key: 'captcha_key_123',
        text: '8A9AWD',
      });

      // Mock loginWithCaptcha
      jest.spyOn(service, 'loginWithCaptcha').mockResolvedValue({
        success: true,
        token: 'fresh_new_jwt_token',
        message: 'Success',
      });

      const result = await service.autoReloginWithRetry(3, 10);
      expect(result).toBeDefined();
      expect(result?.token).toEqual('fresh_new_jwt_token');
    });

    it('should retry up to 3 times if earlier attempts fail, then succeed on attempt 2', async () => {
      await service.savePortalConfig(
        'old_token',
        'old_cookies',
        '0318334886',
        'valid_pass_123',
      );

      jest.spyOn(service, 'getCaptcha').mockResolvedValue({
        content: '<svg>...</svg>',
        key: 'captcha_key_123',
        text: '8A9AWD',
      });

      const loginSpy = jest
        .spyOn(service, 'loginWithCaptcha')
        .mockRejectedValueOnce(new Error('Captcha timeout or incorrect'))
        .mockResolvedValueOnce({
          success: true,
          token: 'recovered_jwt_token_attempt_2',
          message: 'Success',
        });

      const result = await service.autoReloginWithRetry(3, 10);
      expect(loginSpy).toHaveBeenCalledTimes(2);
      expect(result).toBeDefined();
      expect(result?.token).toEqual('recovered_jwt_token_attempt_2');
    });

    it('should return null when all 3 retry attempts fail', async () => {
      await service.savePortalConfig(
        'old_token',
        'old_cookies',
        '0318334886',
        'wrong_pass',
      );

      jest.spyOn(service, 'getCaptcha').mockResolvedValue({
        content: '<svg>...</svg>',
        key: 'captcha_key_123',
        text: 'WRONG1',
      });

      const loginSpy = jest
        .spyOn(service, 'loginWithCaptcha')
        .mockRejectedValue(new Error('Invalid credentials'));

      const result = await service.autoReloginWithRetry(3, 10);
      expect(loginSpy).toHaveBeenCalledTimes(3);
      expect(result).toBeNull();
    });
  });
});
