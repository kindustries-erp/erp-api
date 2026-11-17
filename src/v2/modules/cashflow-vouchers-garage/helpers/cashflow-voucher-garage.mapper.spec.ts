import type { CashflowVoucherGarage } from '../entities/cashflow-voucher-garage.entity';
import { toCashflowVoucherRow } from './cashflow-voucher-garage.mapper';

describe('toCashflowVoucherRow', () => {
  it('số tiền thành number, null hóa trường rỗng, không lộ cột nội bộ', () => {
    const row = toCashflowVoucherRow({
      id: 'v1',
      branchExternalId: 'b1',
      voucherCode: 'PT-1',
      voucherType: 'RECEIPT',
      status: 'PAID',
      transDate: '2026-11-17',
      amount: '1500000.50',
      payerType: 'KH',
      source: 'MANUAL',
      isAutoExpected: false,
      createdAt: new Date('2026-11-17T01:00:00Z'),
      pnlPeriodYear: 2026,
      erpBankTransactionId: 'secret',
    } as unknown as CashflowVoucherGarage);
    expect(row).toMatchObject({
      amount: 1500000.5,
      caseId: null,
      note: null,
      createdAt: '2026-11-17T01:00:00.000Z',
    });
    expect(row).not.toHaveProperty('pnlPeriodYear');
    expect(row).not.toHaveProperty('erpBankTransactionId');
  });
});
