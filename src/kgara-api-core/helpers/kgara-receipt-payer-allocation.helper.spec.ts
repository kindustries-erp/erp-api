import { allocateReceiptsToPayers } from './kgara-receipt-payer-allocation.helper';

describe('allocateReceiptsToPayers', () => {
  it('khoản thu khớp phần BH được tính cho BH dù đang ghi payer KH', () => {
    const r = allocateReceiptsToPayers(
      [
        { amount: 500000, payerType: 'KH' },
        { amount: 4592308, payerType: 'KH' },
      ],
      500000,
      4592308,
    );
    expect(r).toEqual({ kh: 500000, bh: 4592308 });
  });

  it('một khoản duy nhất bằng phần BH thì KH chưa thu gì', () => {
    const r = allocateReceiptsToPayers(
      [{ amount: 4769550, payerType: 'KH' }],
      540000,
      4769550,
    );
    expect(r).toEqual({ kh: 0, bh: 4769550 });
  });

  it('giữ nguyên khoản đã ghi rõ payer BH', () => {
    const r = allocateReceiptsToPayers(
      [
        { amount: 1000, payerType: 'BH' },
        { amount: 300, payerType: 'KH' },
      ],
      300,
      1000,
    );
    expect(r).toEqual({ kh: 300, bh: 1000 });
  });

  it('không khớp số tiền thì KH trước tới hết phần KH, phần vượt chuyển cho BH', () => {
    const r = allocateReceiptsToPayers(
      [
        { amount: 500000, payerType: 'KH' },
        { amount: 2916000, payerType: 'KH' },
      ],
      1000000,
      2416000,
    );
    expect(r).toEqual({ kh: 1000000, bh: 2416000 });
  });

  it('phiếu không có phần BH thì toàn bộ là KH', () => {
    const r = allocateReceiptsToPayers(
      [{ amount: 700, payerType: 'KH' }],
      700,
      0,
    );
    expect(r).toEqual({ kh: 700, bh: 0 });
  });

  it('tổng kh + bh luôn bằng tổng các khoản thu', () => {
    const receipts = [
      { amount: 1234, payerType: 'KH' },
      { amount: 5678, payerType: 'OTHER' },
    ];
    const r = allocateReceiptsToPayers(receipts, 2000, 9000);
    expect(r.kh + r.bh).toBe(1234 + 5678);
  });
});
