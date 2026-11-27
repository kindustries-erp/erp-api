import {
  planLegacyReceipts,
  type LegacyReceipt,
  type LegacyReceivableDebt,
} from './legacy-receipt.planner';

const cus = (capacity: number): LegacyReceivableDebt => ({
  id: 'cus',
  partyType: 'CUSTOMER',
  capacity,
});
const ins = (capacity: number): LegacyReceivableDebt => ({
  id: 'ins',
  partyType: 'INSURER',
  capacity,
});
const receipt = (
  id: string,
  payerType: string,
  amount: number,
  transDate: string | null = '2026-07-30',
  createdAt: string | null = '2026-07-30T10:00:00Z',
): LegacyReceipt => ({ id, payerType, amount, transDate, createdAt });

describe('planLegacyReceipts', () => {
  it('GR-PDV2607-0063: thu 8,829,000 của KH, KH nợ 1,882,900 và BH 6,946,100 → chia đủ, không dư', () => {
    const plan = planLegacyReceipts({
      debts: [cus(1_882_900), ins(6_946_100)],
      receipts: [receipt('s1', 'KH', 8_829_000)],
    });
    expect(plan).toEqual([
      {
        settlementId: 's1',
        debtId: 'cus',
        amount: 1_882_900,
        allowOverpay: false,
      },
      {
        settlementId: 's1',
        debtId: 'ins',
        amount: 6_946_100,
        allowOverpay: false,
      },
    ]);
  });

  it('GR-PDV2608-0044: thu 10,799,000, phần dư sau khi đủ mọi dòng ghi vào dòng KH với allowOverpay', () => {
    const plan = planLegacyReceipts({
      debts: [cus(1_621_000), ins(4_589_000)],
      receipts: [receipt('s1', 'KH', 10_799_000)],
    });
    const total = plan.reduce((s, p) => s + p.amount, 0);
    expect(total).toBe(10_799_000);
    expect(plan.find((p) => p.debtId === 'cus')).toEqual({
      settlementId: 's1',
      debtId: 'cus',
      amount: 6_210_000,
      allowOverpay: true,
    });
    expect(plan.find((p) => p.debtId === 'ins')).toEqual({
      settlementId: 's1',
      debtId: 'ins',
      amount: 4_589_000,
      allowOverpay: false,
    });
  });

  it('thu thiếu: chỉ chia phần có sức chứa, không đánh dấu dư', () => {
    const plan = planLegacyReceipts({
      debts: [cus(1_000), ins(500)],
      receipts: [receipt('s1', 'KH', 700)],
    });
    expect(plan).toEqual([
      { settlementId: 's1', debtId: 'cus', amount: 700, allowOverpay: false },
    ]);
  });

  it('sức chứa giảm theo các khoản thu trước: khoản thứ hai của BH vào dòng INSURER còn lại', () => {
    const plan = planLegacyReceipts({
      debts: [cus(1_000), ins(500)],
      receipts: [
        receipt('s1', 'KH', 1_000, '2026-07-30'),
        receipt('s2', 'BH', 500, '2026-07-31'),
      ],
    });
    expect(plan).toEqual([
      { settlementId: 's1', debtId: 'cus', amount: 1_000, allowOverpay: false },
      { settlementId: 's2', debtId: 'ins', amount: 500, allowOverpay: false },
    ]);
  });

  it('BH không có dòng INSURER thì thu vào dòng KH', () => {
    const plan = planLegacyReceipts({
      debts: [cus(800)],
      receipts: [receipt('s1', 'BH', 800)],
    });
    expect(plan).toEqual([
      { settlementId: 's1', debtId: 'cus', amount: 800, allowOverpay: false },
    ]);
  });

  it('vụ không có dòng phải thu nào thì không tạo phân bổ', () => {
    const plan = planLegacyReceipts({
      debts: [],
      receipts: [receipt('s1', 'KH', 300)],
    });
    expect(plan).toEqual([]);
  });

  it('bỏ qua khoản thu có số tiền không dương và sức chứa âm được kẹp về 0', () => {
    const plan = planLegacyReceipts({
      debts: [cus(-50), ins(200)],
      receipts: [receipt('s0', 'KH', 0), receipt('s1', 'BH', 150)],
    });
    expect(plan).toEqual([
      { settlementId: 's1', debtId: 'ins', amount: 150, allowOverpay: false },
    ]);
  });

  it('kết quả không đổi khi đảo thứ tự đầu vào (thứ tự xử lý cố định theo ngày, thời điểm, id)', () => {
    const debts = [cus(1_000), ins(500)];
    const receipts = [
      receipt('a', 'KH', 900, '2026-07-30'),
      receipt('b', 'BH', 600, '2026-07-31'),
      receipt('c', 'KH', 400, '2026-07-31'),
    ];
    const forward = planLegacyReceipts({ debts, receipts });
    const reversed = planLegacyReceipts({
      debts: [...debts].reverse(),
      receipts: [...receipts].reverse(),
    });
    expect(reversed).toEqual(forward);
  });
});
