import { classifyVoucher, summarizeLedger } from './garage-ledger-classifier';

describe('classifyVoucher', () => {
  it.each([
    ['RECEIPT', 'EXPECTED', 'EXPECTED_IN'],
    ['RECEIPT', 'PAID', 'ACTUAL_IN'],
    ['RECEIPT', null, 'ACTUAL_IN'],
    ['RECEIPT', 'CANCELLED', null],
    ['PAYMENT', 'PENDING', 'PLANNED_OUT'],
    ['PAYMENT', 'APPROVED', 'PLANNED_OUT'],
    ['PAYMENT', 'PAID', 'ACTUAL_OUT'],
    ['PAYMENT', null, 'ACTUAL_OUT'],
    ['PAYMENT', 'CANCELLED', null],
    ['PAYMENT', 'EXPECTED', null],
  ])('%s + %s => %s', (voucherType, paymentStatus, expected) => {
    expect(classifyVoucher({ voucherType, paymentStatus })).toBe(expected);
  });

  it('phiếu không rõ loại thì không tính vào tổng', () => {
    expect(
      classifyVoucher({ voucherType: 'OTHER', paymentStatus: 'PAID' }),
    ).toBeNull();
  });
});

describe('summarizeLedger', () => {
  it('cộng theo nhóm và tính thực thu − thực chi, không gộp dự thu/dự chi vào thực', () => {
    const totals = summarizeLedger([
      { category: 'ACTUAL_IN', amount: 1000 },
      { category: 'EXPECTED_IN', amount: 300 },
      { category: 'ACTUAL_OUT', amount: 400 },
      { category: 'PLANNED_OUT', amount: 200 },
    ]);
    expect(totals).toEqual({
      actualIn: 1000,
      expectedIn: 300,
      actualOut: 400,
      plannedOut: 200,
      net: 600,
    });
  });

  it('danh sách rỗng trả về 0', () => {
    expect(summarizeLedger([]).net).toBe(0);
  });
});
