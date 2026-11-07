import {
  allocatePaymentToLines,
  paymentRequestStatusAfter,
  remainingCapacityCents,
  sourcePaymentStatus,
  toCents,
} from '@/v2/core/cashflow-core/services/cashflow-payment-request.rules';

/**
 * Luồng DNTT đa PO theo quy tắc thuần (không DB): DNTT 2 dòng, chi nhiều lần, hủy một lần chi,
 * và chặn vượt trần PO khi đã có DNTT khác đang hiệu lực.
 * Các bước SQL/khóa được kiểm ở spec riêng của từng service.
 */
describe('Luồng DNTT Garage (quy tắc thuần)', () => {
  // DNTT gồm hai dòng: PO A 300, PO B 200 (tổng 500).
  const lines = () => [
    { id: 'lineA', amountCents: toCents(300), paidCents: 0 },
    { id: 'lineB', amountCents: toCents(200), paidCents: 0 },
  ];
  const totalCents = toCents(500);

  /** Trạng thái dòng sau khi áp các khoản chi (giả lập ghi vào line_payments). */
  function applyPayments(
    state: Array<{ id: string; amountCents: number; paidCents: number }>,
    allocs: Array<{ lineId: string; amountCents: number }>,
  ) {
    for (const a of allocs) {
      const line = state.find((l) => l.id === a.lineId);
      if (!line) throw new Error(`không có dòng ${a.lineId}`);
      line.paidCents += a.amountCents;
    }
    return state;
  }

  it('chi một phần rồi chi đủ: DNTT APPROVED -> PARTIAL -> PAID', () => {
    const state = lines();

    const first = allocatePaymentToLines(state, toCents(150));
    expect(first).toEqual([{ lineId: 'lineA', amountCents: toCents(150) }]);
    applyPayments(state, first);
    expect(
      paymentRequestStatusAfter(totalCents, toCents(150), 'APPROVED'),
    ).toBe('PARTIAL');

    const rest = allocatePaymentToLines(state, toCents(350));
    expect(rest).toEqual([
      { lineId: 'lineA', amountCents: toCents(150) },
      { lineId: 'lineB', amountCents: toCents(200) },
    ]);
    applyPayments(state, rest);
    expect(paymentRequestStatusAfter(totalCents, toCents(500), 'PARTIAL')).toBe(
      'PAID',
    );
  });

  it('chi vượt phần còn lại bị từ chối, không phân bổ gì', () => {
    const state = lines();
    applyPayments(state, allocatePaymentToLines(state, toCents(450)));
    expect(() => allocatePaymentToLines(state, toCents(60))).toThrow(
      'vượt phần còn lại',
    );
  });

  it('hủy một lần chi: DNTT PAID quay về PARTIAL, PO trả về PARTIAL', () => {
    // Đã chi đủ 500, hủy khoản 150 trên dòng A -> còn 350.
    expect(paymentRequestStatusAfter(totalCents, toCents(350), 'PAID')).toBe(
      'PARTIAL',
    );
    // PO A có trần 300, đã chi 300 -> hủy 150 -> còn 150 đã chi.
    expect(sourcePaymentStatus(toCents(300), toCents(150))).toBe('PARTIAL');
  });

  it('hủy hết các lần chi: DNTT về APPROVED, PO về UNPAID', () => {
    expect(paymentRequestStatusAfter(totalCents, 0, 'PARTIAL')).toBe(
      'APPROVED',
    );
    expect(sourcePaymentStatus(toCents(300), 0)).toBe('UNPAID');
  });

  it('DNTT chưa duyệt hoặc đã hủy giữ nguyên trạng thái khi thực chi thay đổi', () => {
    expect(
      paymentRequestStatusAfter(totalCents, toCents(100), 'PENDING_APPROVAL'),
    ).toBe('PENDING_APPROVAL');
    expect(
      paymentRequestStatusAfter(totalCents, toCents(100), 'CANCELLED'),
    ).toBe('CANCELLED');
  });

  it('PO có DNTT đang hiệu lực: DNTT thứ hai chỉ được lấy phần còn lại dưới trần', () => {
    // Trần PO A là 300; DNTT thứ nhất giữ 200 đang hiệu lực.
    const capA = toCents(300);
    const firstActive = toCents(200);
    expect(remainingCapacityCents(capA, firstActive)).toBe(toCents(100));
    // DNTT thứ hai xin 150 cho PO A: vượt 100 còn lại -> bị chặn ở tầng validator.
    expect(toCents(150) > remainingCapacityCents(capA, firstActive)).toBe(true);
  });

  it('DNTT bị hủy (không còn hiệu lực) trả lại trần cho PO', () => {
    const capA = toCents(300);
    expect(remainingCapacityCents(capA, 0)).toBe(capA);
  });
});
