import { describe, expect, it } from '@jest/globals';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { PortalFetchDto } from './portal-invoice.dto';
import { PortalTokenDto } from './portal-token.dto';
import { BulkDownloadXmlDto } from './bulk-download-xml.dto';

const errorsOf = <T extends object>(cls: new () => T, plain: object) =>
  validateSync(plainToInstance(cls, plain));

describe('DTO portal GDT', () => {
  describe('PortalFetchDto', () => {
    it('chấp nhận khoảng ngày YYYY-MM-DD', () => {
      expect(
        errorsOf(PortalFetchDto, {
          dateFrom: '2026-10-01',
          dateTo: '2026-10-09',
        }),
      ).toHaveLength(0);
    });

    it('từ chối ngày sai định dạng', () => {
      expect(
        errorsOf(PortalFetchDto, {
          dateFrom: '01/10/2026',
          dateTo: '2026-10-09',
        }),
      ).not.toHaveLength(0);
    });

    it('từ chối loại không thuộc purchase/sold', () => {
      expect(
        errorsOf(PortalFetchDto, {
          dateFrom: '2026-10-01',
          dateTo: '2026-10-09',
          type: 'other',
        }),
      ).not.toHaveLength(0);
    });
  });

  describe('PortalTokenDto', () => {
    it('chấp nhận token rỗng (giữ hành vi lưu cấu hình cũ)', () => {
      expect(errorsOf(PortalTokenDto, { token: '' })).toHaveLength(0);
    });

    it('từ chối username vượt 100 ký tự', () => {
      expect(
        errorsOf(PortalTokenDto, { token: 'a', username: 'x'.repeat(101) }),
      ).not.toHaveLength(0);
    });
  });

  describe('BulkDownloadXmlDto', () => {
    it('chỉ chấp nhận IN hoặc OUT', () => {
      expect(errorsOf(BulkDownloadXmlDto, { direction: 'IN' })).toHaveLength(0);
      expect(
        errorsOf(BulkDownloadXmlDto, { direction: 'ALL' }),
      ).not.toHaveLength(0);
    });
  });
});
