import { resolveKgaraCaseMoney } from './kgara-case-money';

const base = {
  doanhThu: null,
  tienCoThue: null,
  chiPhi: null,
  loiNhuan: null,
};

describe('resolveKgaraCaseMoney (khớp quy tắc V1)', () => {
  it('ưu tiên bảng lợi nhuận gộp khi có', () => {
    const money = resolveKgaraCaseMoney(
      { ...base, doanhThu: 100, chiPhi: 40, loiNhuan: 60 },
      { doanhThu: 1000, chiPhi: 400, loiNhuan: 600 },
    );
    expect(money).toEqual({ revenue: 1000, cost: 400, profit: 600 });
  });

  it('không có gross profit thì lấy cột của vụ việc', () => {
    const money = resolveKgaraCaseMoney(
      { ...base, doanhThu: 100, chiPhi: 40, loiNhuan: 60 },
      null,
    );
    expect(money).toEqual({ revenue: 100, cost: 40, profit: 60 });
  });

  it('doanh thu thiếu thì dùng tiền có thuế; không có gì thì 0', () => {
    expect(
      resolveKgaraCaseMoney({ ...base, tienCoThue: 250 }, undefined),
    ).toEqual({ revenue: 250, cost: 0, profit: 250 });
    expect(resolveKgaraCaseMoney(base, undefined)).toEqual({
      revenue: 0,
      cost: 0,
      profit: 0,
    });
  });

  it('lợi nhuận thiếu thì tính doanh thu trừ chi phí', () => {
    const money = resolveKgaraCaseMoney(
      { ...base, doanhThu: 500, chiPhi: 200 },
      { doanhThu: 500, chiPhi: 200, loiNhuan: null },
    );
    expect(money.profit).toBe(300);
  });
});
