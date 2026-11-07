import { CashflowForecast } from '@/v2/core/cashflow-core';
import { CashflowGarageForecastExt } from '../entities/cashflow-garage-forecast-ext.entity';
import {
  toLegacyPaymentStatus,
  toLegacyVoucherResponse,
  toLegacyVoucherType,
} from './legacy-voucher.mapper';

function header(overrides: Partial<CashflowForecast> = {}): CashflowForecast {
  return Object.assign(new CashflowForecast(), {
    id: 'v-1',
    code: 'PC-2026-0001',
    direction: 'OUT',
    kind: 'OTHER',
    status: 'PENDING_APPROVAL',
    amount: '1500000.00',
    partnerName: 'NCC A',
    note: null,
    createdBy: 'user-1',
    createdAt: new Date('2026-11-01T02:00:00.000Z'),
    updatedAt: new Date('2026-11-02T02:00:00.000Z'),
    ...overrides,
  });
}

describe('legacy voucher compat mapper', () => {
  describe('toLegacyVoucherType', () => {
    it('dự thu là RECEIPT, dự chi là PAYMENT', () => {
      expect(toLegacyVoucherType('IN')).toBe('RECEIPT');
      expect(toLegacyVoucherType('OUT')).toBe('PAYMENT');
    });
  });

  describe('toLegacyPaymentStatus', () => {
    it.each([
      ['OUT', 'DRAFT', 'PENDING'],
      ['OUT', 'PENDING_APPROVAL', 'PENDING'],
      ['OUT', 'REJECTED', 'PENDING'],
      ['OUT', 'OPEN', 'APPROVED'],
      ['OUT', 'PARTIAL', 'APPROVED'],
      ['OUT', 'SETTLED', 'PAID'],
      ['OUT', 'CANCELLED', 'CANCELLED'],
      ['IN', 'OPEN', 'EXPECTED'],
      ['IN', 'PARTIAL', 'EXPECTED'],
      ['IN', 'SETTLED', 'PAID'],
      ['IN', 'CANCELLED', 'CANCELLED'],
    ])('%s / %s -> %s', (direction, status, expected) => {
      expect(toLegacyPaymentStatus(direction as 'IN' | 'OUT', status)).toBe(
        expected,
      );
    });
  });

  describe('toLegacyVoucherResponse', () => {
    it('dựng đủ trường cũ, amount là số, thời gian ISO', () => {
      const ext = Object.assign(new CashflowGarageForecastExt(), {
        forecastId: 'v-1',
        caseId: 'case-1',
        licensePlate: '29A-123.45',
        paymentContent: 'Trả NCC',
        isAutoExpected: false,
        isAutoCommission: false,
        pnlPeriodYear: null,
        pnlPeriodMonth: null,
        pnlCommissionType: null,
        pnlCommissionAnchorId: null,
      });
      const dto = toLegacyVoucherResponse({
        header: header(),
        ext,
        transDate: '2026-11-05',
        paymentMethod: 'BANK',
        referenceNumber: 'REF-1',
        erpBankTransactionId: 'bank-1',
        caseRow: { id: 'case-1', khachHangName: 'Khách A' },
      });

      expect(dto).toMatchObject({
        id: 'v-1',
        voucherCode: 'PC-2026-0001',
        voucherType: 'PAYMENT',
        amount: 1500000,
        transDate: '2026-11-05',
        licensePlate: '29A-123.45',
        paymentContent: 'Trả NCC',
        paymentStatus: 'PENDING',
        paymentMethod: 'BANK',
        referenceNumber: 'REF-1',
        caseId: 'case-1',
        erpBankTransactionId: 'bank-1',
        erpBankTransaction: null,
        createdAt: '2026-11-01T02:00:00.000Z',
        updatedAt: '2026-11-02T02:00:00.000Z',
        case: { id: 'case-1', khachHangName: 'Khách A', bienSoXe: null },
      });
    });

    it('thiếu ext và case thì trả null, không ném lỗi', () => {
      const dto = toLegacyVoucherResponse({
        header: header({ direction: 'IN', status: 'OPEN' }),
        ext: null,
        transDate: '2026-11-05',
      });
      expect(dto.voucherType).toBe('RECEIPT');
      expect(dto.paymentStatus).toBe('EXPECTED');
      expect(dto.licensePlate).toBeNull();
      expect(dto.case).toBeNull();
      expect(dto.isAutoExpected).toBe(false);
    });
  });
});
