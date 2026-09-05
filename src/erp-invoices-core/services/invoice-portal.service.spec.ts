import { UnauthorizedException } from '@nestjs/common';
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

    it('should return null when all 3 retry attempts fail for non-401 errors', async () => {
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
        .mockRejectedValue(new Error('Network timeout'));

      const result = await service.autoReloginWithRetry(3, 10);
      expect(loginSpy).toHaveBeenCalledTimes(3);
      expect(result).toBeNull();
    });

    it('should NOT retry if login fails with 401 Unauthorized to prevent account lockout', async () => {
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
        .mockRejectedValue(new UnauthorizedException('HTTP 401 Unauthorized'));

      const result = await service.autoReloginWithRetry(3, 10);
      expect(loginSpy).toHaveBeenCalledTimes(1);
      expect(result).toBeNull();
    });
  });

  describe('checkTokenValid', () => {
    it('should return false if token is empty', async () => {
      expect(await service.checkTokenValid('')).toBe(false);
    });
  });

  describe('Relative Invoice Sync (Adjustment / Replacement)', () => {
    describe('fetchRelativeInvoice', () => {
      it('should return null immediately if taxInvoiceStatus is not 2 or 3', async () => {
        const inv: any = {
          invoiceNo: '100',
          serialNo: 'C26TGA',
          taxInvoiceStatus: 1, // regular active invoice
        };

        const result = await service.fetchRelativeInvoice(inv, 'test_token');
        expect(result).toBeNull();
      });

      it('should fetch relative invoice data when taxInvoiceStatus is 2 (adjustment)', async () => {
        const inv: any = {
          id: 'inv-adj-1',
          invoiceNo: '1356',
          serialNo: 'C26TGA',
          sellerTaxCode: '0318334886-003',
          taxInvoiceStatus: 2,
          taxInvoiceType: 'STANDARD',
        };

        const mockResponseData = {
          nbmst: '0318334886-003',
          khmshdon: 1,
          khhdon: 'C26TGA',
          shdon: 1356,
          khhdgoc: 'C26TGA',
          khmshdgoc: 1,
          shdgoc: '1231',
          lhdgoc: 1,
          tthai: 5,
        };

        // Mock global fetch
        const globalFetchSpy = jest
          .spyOn(global, 'fetch')
          .mockResolvedValueOnce(
            new Response(JSON.stringify(mockResponseData), { status: 200 }),
          );

        const result = await service.fetchRelativeInvoice(
          inv,
          'token_123',
          'cookie_123',
        );

        expect(result).toBeDefined();
        expect(result?.shdgoc).toEqual('1231');
        expect(result?.khhdgoc).toEqual('C26TGA');
        expect(result?.lhdgoc).toEqual(1);
        expect(result?.nbmst).toEqual('0318334886-003');

        globalFetchSpy.mockRestore();
      });

      it('should use sco-query for CASH_REGISTER invoices', async () => {
        const inv: any = {
          id: 'inv-sco-1',
          invoiceNo: '351',
          serialNo: 'C26MPL',
          sellerTaxCode: '0304609065',
          taxInvoiceStatus: 3,
          taxInvoiceType: 'CASH_REGISTER',
        };

        const mockResponseData = {
          nbmst: '0304609065',
          khmshdon: 1,
          khhdon: 'C26MPL',
          shdon: 351,
          khhdgoc: 'C26MPL',
          shdgoc: '200',
          lhdgoc: 2,
        };

        let calledUrl = '';
        const globalFetchSpy = jest
          .spyOn(global, 'fetch')
          .mockImplementationOnce((url: any) => {
            calledUrl = url.toString();
            return Promise.resolve(
              new Response(JSON.stringify(mockResponseData), { status: 200 }),
            );
          });

        const result = await service.fetchRelativeInvoice(inv, 'token_sco');

        expect(calledUrl).toContain('/sco-query/invoices/relative');
        expect(result?.shdgoc).toEqual('200');
        expect(result?.lhdgoc).toEqual(2);

        globalFetchSpy.mockRestore();
      });

      it('should return null when GDT returns no shdgoc or empty response', async () => {
        const inv: any = {
          invoiceNo: '999',
          serialNo: 'C26TGA',
          sellerTaxCode: '0318334886',
          taxInvoiceStatus: 2,
        };

        const globalFetchSpy = jest
          .spyOn(global, 'fetch')
          .mockResolvedValueOnce(
            new Response(JSON.stringify({ shdgoc: null }), { status: 200 }),
          );

        const result = await service.fetchRelativeInvoice(inv, 'token');
        expect(result).toBeNull();

        globalFetchSpy.mockRestore();
      });
    });

    describe('syncRelatedInvoiceStatus', () => {
      it('should update original IN invoice status to 4 (adjusted) when current invoice status is 2', async () => {
        const currentInvoice: any = {
          id: 'curr-1',
          invoiceNo: '1356',
          direction: 'IN',
          taxInvoiceStatus: 2, // adjustment
        };

        const originalInvoice: any = {
          id: 'orig-uuid-1',
          invoiceNo: '1231',
          serialNo: 'C26TGA',
          sellerTaxCode: '0318334886-003',
          direction: 'IN',
          taxInvoiceStatus: 1, // original active
        };

        mockInvoiceRepo.findOne.mockResolvedValueOnce(originalInvoice);

        await service.syncRelatedInvoiceStatus(
          {
            shdgoc: '1231',
            khhdgoc: 'C26TGA',
            nbmst: '0318334886-003',
          },
          currentInvoice,
        );

        expect(mockInvoiceRepo.findOne).toHaveBeenCalledWith({
          where: {
            invoiceNo: '1231',
            serialNo: 'C26TGA',
            sellerTaxCode: '0318334886-003',
            direction: 'IN',
            isDeleted: false,
          },
        });
        expect(mockInvoiceRepo.update).toHaveBeenCalledWith('orig-uuid-1', {
          taxInvoiceStatus: 4,
        });
      });

      it('should update original OUT invoice status to 5 (replaced) when current invoice status is 3', async () => {
        const currentInvoice: any = {
          id: 'curr-out-1',
          invoiceNo: '999',
          direction: 'OUT',
          taxInvoiceStatus: 3, // replacement
        };

        const originalInvoice: any = {
          id: 'orig-out-uuid-2',
          invoiceNo: '888',
          serialNo: 'C26TGA',
          direction: 'OUT',
          taxInvoiceStatus: 1,
        };

        mockInvoiceRepo.findOne.mockResolvedValueOnce(originalInvoice);

        await service.syncRelatedInvoiceStatus(
          {
            shdgoc: '888',
            khhdgoc: 'C26TGA',
            nbmst: '0318334886',
          },
          currentInvoice,
        );

        // For OUT, sellerTaxCode is not included in query
        expect(mockInvoiceRepo.findOne).toHaveBeenCalledWith({
          where: {
            invoiceNo: '888',
            serialNo: 'C26TGA',
            direction: 'OUT',
            isDeleted: false,
          },
        });
        expect(mockInvoiceRepo.update).toHaveBeenCalledWith('orig-out-uuid-2', {
          taxInvoiceStatus: 5,
        });
      });

      it('should re-download XML for original invoice when token is provided', async () => {
        const currentInvoice: any = {
          id: 'curr-1',
          invoiceNo: '1356',
          direction: 'IN',
          taxInvoiceStatus: 2,
        };

        const originalInvoice: any = {
          id: 'orig-uuid-1',
          invoiceNo: '1231',
          serialNo: 'C26TGA',
          sellerTaxCode: '0318334886-003',
          direction: 'IN',
          taxInvoiceStatus: 1,
        };

        mockInvoiceRepo.findOne.mockResolvedValueOnce(originalInvoice);
        const downloadXmlOnlySpy = jest
          .spyOn(service, 'downloadXmlOnly')
          .mockResolvedValueOnce();

        await service.syncRelatedInvoiceStatus(
          {
            shdgoc: '1231',
            khhdgoc: 'C26TGA',
            nbmst: '0318334886-003',
          },
          currentInvoice,
          'token_xyz',
          'cookies_xyz',
        );

        expect(downloadXmlOnlySpy).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'orig-uuid-1', taxInvoiceStatus: 4 }),
          'token_xyz',
          'cookies_xyz',
        );

        downloadXmlOnlySpy.mockRestore();
      });

      it('should handle gracefully when original invoice is not found in DB', async () => {
        const currentInvoice: any = {
          id: 'curr-3',
          invoiceNo: '555',
          direction: 'IN',
          taxInvoiceStatus: 2,
        };

        await service.syncRelatedInvoiceStatus(
          {
            shdgoc: '444',
            khhdgoc: 'C26TGA',
            nbmst: '0318334886',
          },
          currentInvoice,
        );

        expect(mockInvoiceRepo.update).not.toHaveBeenCalled();
      });
    });

    describe('bulkDownloadXml & syncFromPortal backlog queueing', () => {
      it('bulkDownloadXml should include invoices with taxInvoiceStatus 2/3 and missing relatedInvoiceNo', async () => {
        mockInvoiceRepo.find.mockResolvedValueOnce([]);

        await service.bulkDownloadXml('token_1', 'cookie_1', 'IN');

        expect(mockInvoiceRepo.find).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.arrayContaining([
              expect.objectContaining({
                source: 'PORTAL',
                direction: 'IN',
                isDeleted: false,
              }),
            ]),
          }),
        );
      });
    });
  });
});
