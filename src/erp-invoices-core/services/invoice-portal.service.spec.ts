import { BadRequestException } from '@nestjs/common';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { InvoicePortalService } from './invoice-portal.service';
import { fetchWithRetry } from '../helpers/invoice-gdt.helper';
import { sleep } from '../../common/utils/delay.util';

jest.mock('../helpers/invoice-gdt.helper', () => {
  return {
    fetchWithRetry: jest.fn(),
    sleep: jest.fn(),
    resolvePortalVatRate: jest.fn(),
    parsePortalIsoDate: jest.fn(),
    buildInvoiceR2Key: jest.fn(),
    extractXmlFromBuffer: jest.fn(),
  };
});

describe('InvoicePortalService - taxpayer validation', () => {
  let service: InvoicePortalService;
  let companyProfileRepo: any;
  const mockedFetchWithRetry = fetchWithRetry as jest.MockedFunction<
    typeof fetchWithRetry
  >;

  beforeEach(() => {
    companyProfileRepo = {
      findOne: jest.fn(),
    };

    service = new InvoicePortalService(
      {} as any,
      companyProfileRepo as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    jest.clearAllMocks();
  });

  it('throws when company tax code is not configured', async () => {
    companyProfileRepo.findOne.mockResolvedValue({ tax_code: null });

    await expect(
      (service as any).validatePortalTaxpayer('token', 'cookie'),
    ).rejects.toThrow('GDT_COMPANY_TAX_CODE_NOT_CONFIGURED');
  });

  it('throws mismatch when GDT profile tax codes do not contain configured tax code', async () => {
    companyProfileRepo.findOne.mockResolvedValue({
      tax_code: '0318334886-003',
    });

    mockedFetchWithRetry.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: '0318334886-999',
        groupId: '0318334886-999',
        tinInfoTT86: {
          mst: '0318334886-999',
          dsMst: ['0318334886-999'],
        },
      }),
    } as Response);

    await expect(
      (service as any).validatePortalTaxpayer('token', 'cookie'),
    ).rejects.toThrow('GDT_TAXPAYER_MISMATCH');
  });

  it('passes when configured tax code exists in GDT profile tax code set', async () => {
    companyProfileRepo.findOne.mockResolvedValue({
      tax_code: '0318334886-003',
    });

    mockedFetchWithRetry.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        username: '0318334886-003',
        groupId: '0318334886-003',
        groupIds: '0318334886-003',
        tinInfoTT86: {
          mst: '0318334886-003',
          mstUTien: '0318334886-003',
          dsMst: ['0318334886-003'],
        },
      }),
    } as Response);

    await expect(
      (service as any).validatePortalTaxpayer('token-value', 'cookie-value'),
    ).resolves.toBeUndefined();

    expect(mockedFetchWithRetry).toHaveBeenCalledWith(
      'https://hoadondientu.gdt.gov.vn/api/security-taxpayer/profile',
      {
        headers: {
          Authorization: 'Bearer token-value',
          Cookie: 'cookie-value',
        },
      },
    );
  });

  it('maps non-401/403 profile API failure to GDT_PROFILE_FETCH_FAILED', async () => {
    companyProfileRepo.findOne.mockResolvedValue({
      tax_code: '0318334886-003',
    });

    mockedFetchWithRetry.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as Response);

    await expect(
      (service as any).validatePortalTaxpayer('token', undefined),
    ).rejects.toThrow('GDT_PROFILE_FETCH_FAILED');
  });

  it('throws GDT_TOKEN_EXPIRED on 401/403 profile response', async () => {
    companyProfileRepo.findOne.mockResolvedValue({
      tax_code: '0318334886-003',
    });

    mockedFetchWithRetry.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
    } as Response);

    await expect(
      (service as any).validatePortalTaxpayer('token', undefined),
    ).rejects.toThrow('GDT_TOKEN_EXPIRED');
  });

  it('throws when profile does not provide any usable tax code fields', async () => {
    companyProfileRepo.findOne.mockResolvedValue({
      tax_code: '0318334886-003',
    });

    mockedFetchWithRetry.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        authorities: [],
      }),
    } as Response);

    await expect(
      (service as any).validatePortalTaxpayer('token', undefined),
    ).rejects.toThrow('GDT_PROFILE_MISSING_TAX_CODE');
  });

  it('converts validation error to bad request at sync entry point', async () => {
    companyProfileRepo.findOne.mockResolvedValue({ tax_code: null });

    await expect(
      service.syncFromPortal(
        {
          token: 'token',
          cookies: 'cookie',
          dateFrom: '2026-07-01',
          dateTo: '2026-07-01',
          type: 'purchase',
        },
        'user-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  describe('Captcha and Login', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('getCaptcha returns content and key on success', async () => {
      (global as any).fetch = jest.fn().mockImplementation(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          content: 'base64imagecontent',
          key: 'captcha-key-123',
        }),
      }));

      const result = await service.getCaptcha();
      expect(result).toEqual({
        content: 'base64imagecontent',
        key: 'captcha-key-123',
        text: '',
      });
    });

    it('getCaptcha throws BadRequestException when GDT returns error', async () => {
      (global as any).fetch = jest.fn().mockImplementation(async () => ({
        ok: false,
        status: 500,
      }));

      await expect(service.getCaptcha()).rejects.toThrow(BadRequestException);
    });

    it('loginWithCaptcha validates required fields', async () => {
      await expect(
        service.loginWithCaptcha({
          username: '',
          cvalue: 'ABC',
          ckey: 'key',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('loginWithCaptcha authenticates, extracts token & cookies, and saves config', async () => {
      companyProfileRepo.findOne.mockResolvedValue({
        company_name: 'Test Co',
        gdt_portal_token: '',
      });
      companyProfileRepo.save = jest.fn();

      (global as any).fetch = jest.fn().mockImplementation(async () => ({
        ok: true,
        status: 200,
        headers: {
          get: (name: string) => {
            if (name.toLowerCase() === 'set-cookie') {
              return 'TS0114b13e=abcdef; Path=/; Domain=.gdt.gov.vn';
            }
            return null;
          },
        },
        json: async () => ({
          token: 'jwt-token-12345',
        }),
      }));

      const result = await service.loginWithCaptcha({
        username: '0318334886-003',
        password: 'Password!123',
        cvalue: 'VMRBXR',
        ckey: '6a7ee9b2fed74d6863e9238d',
      });

      expect(result.success).toBe(true);
      expect(result.token).toBe('jwt-token-12345');
      expect(companyProfileRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          gdt_portal_token: 'jwt-token-12345',
          gdt_portal_cookies: 'TS0114b13e=abcdef',
          gdt_portal_username: '0318334886-003',
          gdt_portal_password: 'Password!123',
        }),
      );
    });

    it('loginWithCaptcha throws when authentication fails', async () => {
      (global as any).fetch = jest.fn().mockImplementation(async () => ({
        ok: false,
        status: 400,
        json: async () => ({
          message: 'Mã xác thực không chính xác',
        }),
      }));

      await expect(
        service.loginWithCaptcha({
          username: '0318334886-003',
          password: 'Password!123',
          cvalue: 'WRONG',
          ckey: 'key',
        }),
      ).rejects.toThrow('Mã xác thực không chính xác');
    });
  });
});
