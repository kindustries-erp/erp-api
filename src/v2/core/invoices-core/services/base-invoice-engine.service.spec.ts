import { BadRequestException } from '@nestjs/common';
import { BaseInvoiceEngineService } from './base-invoice-engine.service';

describe('BaseInvoiceEngineService', () => {
  let service: BaseInvoiceEngineService;

  beforeEach(() => {
    service = new BaseInvoiceEngineService();
  });

  describe('normalizeInvoiceNo', () => {
    it('should strip leading zeros from the final number group', () => {
      expect(service.normalizeInvoiceNo('0001234')).toBe('1234');
      expect(service.normalizeInvoiceNo('AB-00045')).toBe('AB-45');
      expect(service.normalizeInvoiceNo('HD00001')).toBe('HD1');
    });

    it('should return null for empty or null inputs', () => {
      expect(service.normalizeInvoiceNo(null)).toBeNull();
      expect(service.normalizeInvoiceNo(undefined)).toBeNull();
      expect(service.normalizeInvoiceNo('')).toBeNull();
    });
  });

  describe('extractInvoiceMetadata', () => {
    it('should extract license plate and settlement order from description and notes', () => {
      const target = {
        description: 'Sửa chữa xe 50H-38666 theo lệnh QT-WO-12345',
        notes: null,
        items: [],
      };
      const result = service.extractInvoiceMetadata(target);
      expect(result.licensePlate).toBe('50H-38666');
      expect(result.settlementOrder).toBe('-WO-12345');
      expect(target).toHaveProperty('licensePlate', '50H-38666');
      expect(target).toHaveProperty('settlementOrder', '-WO-12345');
    });

    it('should handle GR- settlement order prefix', () => {
      const target = {
        description: 'Bảo dưỡng định kỳ GR-99881',
      };
      const result = service.extractInvoiceMetadata(target);
      expect(result.settlementOrder).toBe('GR-99881');
    });
  });

  describe('calculateTotals', () => {
    it('should sum up preVatAmount, vatAmount, discountAmount, and totalAmount correctly', () => {
      const items = [
        {
          preVatAmount: 100000,
          vatAmount: 10000,
          discountAmount: 5000,
          totalAmount: 105000,
        },
        {
          preVatAmount: 200000,
          vatAmount: 20000,
          discountAmount: 0,
          totalAmount: 220000,
        },
      ];
      const totals = service.calculateTotals(items);
      expect(totals.preVatAmount).toBe(300000);
      expect(totals.vatAmount).toBe(30000);
      expect(totals.discountAmount).toBe(5000);
      expect(totals.totalAmount).toBe(325000);
    });

    it('should handle null or empty values gracefully', () => {
      const totals = service.calculateTotals([
        { preVatAmount: null, totalAmount: '50000' },
      ]);
      expect(totals.preVatAmount).toBe(0);
      expect(totals.totalAmount).toBe(50000);
    });
  });

  describe('validatePostingTransition', () => {
    it('should throw BadRequestException if trying to change branch of POSTED invoice', () => {
      expect(() =>
        service.validatePostingTransition('POSTED', 'change_branch'),
      ).toThrow(BadRequestException);
    });

    it('should throw BadRequestException if trying to delete POSTED invoice', () => {
      expect(() =>
        service.validatePostingTransition('POSTED', 'delete'),
      ).toThrow(BadRequestException);
    });

    it('should allow operation if invoice is UNPOSTED', () => {
      expect(() =>
        service.validatePostingTransition('UNPOSTED', 'change_branch'),
      ).not.toThrow();
    });
  });
});
