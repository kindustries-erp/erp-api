import { planReceiptPayerBackfill } from './kgara-receipt-payer-backfill.helper';

const r = (id: string, amount: number, payerType: string | null = 'KH') => ({
  id,
  amount,
  payerType,
});

describe('planReceiptPayerBackfill', () => {
  it('phiếu không có phần BH: không đổi, không mơ hồ', () => {
    expect(planReceiptPayerBackfill([r('a', 500)], 0)).toEqual({
      changes: [],
      ambiguous: false,
    });
  });

  it('đổi đúng khoản khớp phần BH, giữ khoản KH', () => {
    const plan = planReceiptPayerBackfill(
      [r('kh', 200000), r('bh', 800000)],
      800000,
    );
    expect(plan.changes).toEqual([{ id: 'bh', from: 'KH', to: 'BH' }]);
    expect(plan.ambiguous).toBe(false);
  });

  it('không khoản nào khớp: mơ hồ, không đổi', () => {
    const plan = planReceiptPayerBackfill([r('x', 3416000)], 2416000);
    expect(plan.changes).toEqual([]);
    expect(plan.ambiguous).toBe(true);
  });

  it('khoản đã gắn BH được tính, chạy lại không đổi gì thêm (idempotent)', () => {
    const plan = planReceiptPayerBackfill(
      [r('kh', 200000), r('bh', 800000, 'BH')],
      800000,
    );
    expect(plan).toEqual({ changes: [], ambiguous: false });
  });

  it('chỉ khoản đầu khớp được gắn BH khi có hai khoản cùng số tiền', () => {
    const plan = planReceiptPayerBackfill(
      [r('a', 800000), r('b', 800000)],
      800000,
    );
    expect(plan.changes.map((c) => c.id)).toEqual(['a']);
  });
});
