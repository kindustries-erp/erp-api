import { BadRequestException } from '@nestjs/common';
import { BaseVoucherEngineService } from './base-voucher-engine.service';
import { IVoucherLine } from '../contracts/voucher.contract';

describe('BaseVoucherEngineService', () => {
  let service: BaseVoucherEngineService;

  beforeEach(() => {
    service = new BaseVoucherEngineService();
  });

  describe('sumLineAmounts', () => {
    it('should calculate sum correctly with amount or qty * cost', () => {
      const lines: IVoucherLine[] = [
        {
          itemName: 'Bugia',
          qtyReceived: '2',
          unitCost: '50000',
          amount: '100000',
        },
        { itemName: 'Nhớt', qtyReceived: 3, unitCost: 150000, amount: 450000 },
        {
          itemName: 'Lọc gió',
          qtyReceived: 1,
          unitCost: 80000,
          amount: undefined as any,
        },
      ];
      const total = service.sumLineAmounts(lines);
      expect(total).toBe(630000);
    });

    it('should return 0 for empty array', () => {
      expect(service.sumLineAmounts([])).toBe(0);
    });
  });

  describe('validateVoucherTransition', () => {
    it('should allow update on DRAFT', () => {
      expect(() =>
        service.validateVoucherTransition('DRAFT', 'update'),
      ).not.toThrow();
    });

    it('should throw on update if status is POSTED or CANCELLED', () => {
      expect(() =>
        service.validateVoucherTransition('POSTED', 'update'),
      ).toThrow(BadRequestException);
      expect(() =>
        service.validateVoucherTransition('CANCELLED', 'update'),
      ).toThrow(BadRequestException);
    });

    it('should allow post on DRAFT', () => {
      expect(() =>
        service.validateVoucherTransition('DRAFT', 'post'),
      ).not.toThrow();
    });

    it('should throw on post if already POSTED', () => {
      expect(() => service.validateVoucherTransition('POSTED', 'post')).toThrow(
        BadRequestException,
      );
    });

    it('should throw on post if already CANCELLED', () => {
      expect(() =>
        service.validateVoucherTransition('CANCELLED', 'post'),
      ).toThrow(BadRequestException);
    });

    it('should allow cancel on DRAFT or POSTED', () => {
      expect(() =>
        service.validateVoucherTransition('DRAFT', 'cancel'),
      ).not.toThrow();
      expect(() =>
        service.validateVoucherTransition('POSTED', 'cancel'),
      ).not.toThrow();
    });

    it('should throw on cancel if already CANCELLED', () => {
      expect(() =>
        service.validateVoucherTransition('CANCELLED', 'cancel'),
      ).toThrow(BadRequestException);
    });

    it('should allow delete on DRAFT only', () => {
      expect(() =>
        service.validateVoucherTransition('DRAFT', 'delete'),
      ).not.toThrow();
      expect(() =>
        service.validateVoucherTransition('POSTED', 'delete'),
      ).toThrow(BadRequestException);
    });
  });

  describe('generateDailyVoucherNo', () => {
    it('should generate sequence 001 if no prior records exist', async () => {
      const mockRepo = {
        createQueryBuilder: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(null),
        }),
      } as any;

      const date = new Date('2026-11-03T10:00:00Z');
      const code = await service.generateDailyVoucherNo(
        mockRepo,
        'receiptNo',
        'GR',
        date,
      );
      expect(code).toBe('GR-20261103-001');
    });

    it('should increment sequence if prior record exists', async () => {
      const mockRepo = {
        createQueryBuilder: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          getOne: jest
            .fn()
            .mockResolvedValue({ receiptNo: 'GGR-20261103-014' }),
        }),
      } as any;

      const date = new Date('2026-11-03T10:00:00Z');
      const code = await service.generateDailyVoucherNo(
        mockRepo,
        'receiptNo',
        'GGR',
        date,
      );
      expect(code).toBe('GGR-20261103-015');
    });
  });
});
