import { DebtBalanceEngine, toMoney } from './debt-balance.engine';

describe('toMoney', () => {
  it('chuẩn hóa chuỗi numeric của Postgres, rỗng và giá trị không hợp lệ', () => {
    expect(toMoney('1500000.50')).toBe(1500000.5);
    expect(toMoney(null)).toBe(0);
    expect(toMoney(undefined)).toBe(0);
    expect(toMoney('abc')).toBe(0);
    expect(toMoney(Number.NaN)).toBe(0);
  });

  it('làm tròn 2 chữ số', () => {
    expect(toMoney(10.005)).toBe(10.01);
    expect(toMoney(0.1 + 0.2)).toBe(0.3);
  });
});

describe('DebtBalanceEngine.sumAllocations', () => {
  it('cộng không lệch dấu phẩy động', () => {
    expect(DebtBalanceEngine.sumAllocations([0.1, 0.2, '0.3'])).toBe(0.6);
  });

  it('danh sách rỗng bằng 0', () => {
    expect(DebtBalanceEngine.sumAllocations([])).toBe(0);
  });
});

describe('DebtBalanceEngine.compute', () => {
  it('OPEN: còn nợ đủ khi chưa phân bổ', () => {
    expect(DebtBalanceEngine.compute(1000, 0)).toEqual({
      original: 1000,
      allocated: 0,
      balance: 1000,
      overpaid: 0,
      status: 'OPEN',
    });
  });

  it('PARTIAL: trả một phần', () => {
    const result = DebtBalanceEngine.compute('1000', '400');
    expect(result).toMatchObject({
      balance: 600,
      overpaid: 0,
      status: 'PARTIAL',
    });
  });

  it('SETTLED: trả đủ', () => {
    expect(DebtBalanceEngine.compute(1000, 1000)).toMatchObject({
      balance: 0,
      status: 'SETTLED',
    });
  });

  it('OVERPAID: trả dư, số dư kẹp ở 0', () => {
    expect(DebtBalanceEngine.compute(1000, 1200)).toMatchObject({
      balance: 0,
      overpaid: 200,
      status: 'OVERPAID',
    });
  });

  it('khoản gốc bằng 0 và chưa phân bổ là SETTLED', () => {
    expect(DebtBalanceEngine.compute(0, 0)).toMatchObject({
      balance: 0,
      status: 'SETTLED',
    });
    expect(DebtBalanceEngine.compute(null, null)).toMatchObject({
      balance: 0,
      status: 'SETTLED',
    });
  });

  it('khoản gốc âm không tạo số dư âm; phân bổ vào đó là trả dư', () => {
    expect(DebtBalanceEngine.compute(-50, 0)).toMatchObject({
      balance: 0,
      status: 'SETTLED',
    });
    expect(DebtBalanceEngine.compute(-50, 20)).toMatchObject({
      balance: 0,
      overpaid: 20,
      status: 'OVERPAID',
    });
  });
});

describe('DebtBalanceEngine.summarize', () => {
  it('không bù trừ: trả dư khoản này không giảm số dư khoản khác', () => {
    const overpaid = DebtBalanceEngine.compute(100, 150);
    const open = DebtBalanceEngine.compute(200, 0);

    expect(DebtBalanceEngine.summarize([overpaid, open])).toEqual({
      accountCount: 2,
      original: 300,
      allocated: 150,
      balance: 200,
      overpaid: 50,
    });
  });

  it('danh sách rỗng cho tổng bằng 0', () => {
    expect(DebtBalanceEngine.summarize([])).toEqual({
      accountCount: 0,
      original: 0,
      allocated: 0,
      balance: 0,
      overpaid: 0,
    });
  });
});
