import {
  toVoucherResponse,
  toVoucherSummaryResponse,
} from './stock-voucher.mapper';

const base = {
  id: 'v1',
  voucherNo: 'GSR-1',
  voucherDate: new Date('2026-01-01'),
  status: 'DRAFT',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-02'),
};

describe('toVoucherSummaryResponse', () => {
  it('đặt mặc định và không lộ field entity thừa', () => {
    const res = toVoucherSummaryResponse({
      ...base,
      isDeleted: false,
      totalAmount: '1500.50',
    } as any);
    expect(res.extraData).toEqual({});
    expect(res.totalAmount).toBe(1500.5);
    expect(res.branchId).toBeNull();
    expect(res).not.toHaveProperty('isDeleted');
    expect(res).not.toHaveProperty('lines');
  });

  it('totalAmount null khi không có', () => {
    expect(toVoucherSummaryResponse(base).totalAmount).toBeNull();
  });
});

describe('toVoucherResponse', () => {
  it('gồm đầu phiếu và lines', () => {
    const res = toVoucherResponse(base, []);
    expect(res.lines).toEqual([]);
    expect(res.voucherNo).toBe('GSR-1');
  });
});
