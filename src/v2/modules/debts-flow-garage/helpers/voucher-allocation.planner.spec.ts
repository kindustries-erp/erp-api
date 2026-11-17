import {
  planVoucherAllocation,
  type AllocationCandidate,
} from './voucher-allocation.planner';

const cus = (balance: number): AllocationCandidate => ({
  id: 'cus',
  direction: 'RECEIVABLE',
  partyType: 'CUSTOMER',
  balance,
});
const ins = (balance: number): AllocationCandidate => ({
  id: 'ins',
  direction: 'RECEIVABLE',
  partyType: 'INSURER',
  balance,
});
const sup = (balance: number): AllocationCandidate => ({
  id: 'sup',
  direction: 'PAYABLE',
  partyType: 'SUPPLIER',
  balance,
});
const receipt = (
  payerType: string,
  amount: number,
  candidates: AllocationCandidate[],
) =>
  planVoucherAllocation({
    voucherType: 'RECEIPT',
    payerType,
    amount,
    candidates,
  });

describe('planVoucherAllocation', () => {
  it('thu của khách vào dòng CUSTOMER, của bảo hiểm vào dòng INSURER', () => {
    expect(receipt('KH', 300, [ins(500), cus(700)])).toEqual([
      { debtId: 'cus', amount: 300, allowOverpay: false },
    ]);
    expect(receipt('BH', 300, [cus(700), ins(500)])).toEqual([
      { debtId: 'ins', amount: 300, allowOverpay: false },
    ]);
  });

  it('vượt số dư của bên trả thì tràn sang dòng còn lại', () => {
    expect(receipt('KH', 900, [cus(700), ins(500)])).toEqual([
      { debtId: 'cus', amount: 700, allowOverpay: false },
      { debtId: 'ins', amount: 200, allowOverpay: false },
    ]);
  });

  it('vượt tổng số dư thì phần dư dồn vào dòng đầu và cho phép thu dư', () => {
    expect(receipt('KH', 1500, [cus(700), ins(500)])).toEqual([
      { debtId: 'cus', amount: 1000, allowOverpay: true },
      { debtId: 'ins', amount: 500, allowOverpay: false },
    ]);
    expect(receipt('KH', 100, [cus(0)])).toEqual([
      { debtId: 'cus', amount: 100, allowOverpay: true },
    ]);
  });

  it('phiếu chi chỉ vào khoản phải trả; thu không đụng khoản phải trả', () => {
    expect(
      planVoucherAllocation({
        voucherType: 'PAYMENT',
        payerType: 'KH',
        amount: 200,
        candidates: [cus(900), sup(400)],
      }),
    ).toEqual([{ debtId: 'sup', amount: 200, allowOverpay: false }]);
    expect(receipt('KH', 50, [sup(400)])).toEqual([]);
  });

  it('không có khoản nợ thì không phân bổ; số tiền lẻ không lệch dấu phẩy động', () => {
    expect(receipt('KH', 100, [])).toEqual([]);
    const plan = receipt('KH', 0.3, [cus(0.1), ins(0.2)]);
    expect(plan.map((p) => p.amount)).toEqual([0.1, 0.2]);
  });
});
