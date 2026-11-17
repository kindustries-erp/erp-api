import { resolveReceiptPayerType } from './kgara-receipt-payer-resolver.helper';

describe('resolveReceiptPayerType', () => {
  it('explicit thắng', () => {
    expect(
      resolveReceiptPayerType({
        explicit: 'BH',
        amount: 1,
        dueBH: 0,
        paidBH: 0,
      }),
    ).toBe('BH');
    expect(
      resolveReceiptPayerType({
        explicit: 'KH',
        amount: 800,
        dueBH: 800,
        paidBH: 0,
      }),
    ).toBe('KH');
  });

  it('phiếu không có phần BH luôn KH', () => {
    expect(resolveReceiptPayerType({ amount: 500, dueBH: 0, paidBH: 0 })).toBe(
      'KH',
    );
  });

  it('số tiền khớp phần BH còn thiếu (±1000) là BH', () => {
    expect(
      resolveReceiptPayerType({ amount: 800500, dueBH: 800000, paidBH: 0 }),
    ).toBe('BH');
  });

  it('số tiền không khớp là KH', () => {
    expect(
      resolveReceiptPayerType({ amount: 200000, dueBH: 800000, paidBH: 0 }),
    ).toBe('KH');
  });

  it('đã thu đủ BH thì khoản sau là KH; thu BH một phần thì so với phần thiếu', () => {
    expect(
      resolveReceiptPayerType({
        amount: 800000,
        dueBH: 800000,
        paidBH: 800000,
      }),
    ).toBe('KH');
    expect(
      resolveReceiptPayerType({
        amount: 300000,
        dueBH: 800000,
        paidBH: 500000,
      }),
    ).toBe('BH');
  });
});
