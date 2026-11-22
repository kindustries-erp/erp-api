import { customerReceivable, insuranceReceivable } from './case-list.mapper';

describe('insuranceReceivable / customerReceivable', () => {
  it('ưu tiên TienThanhToanBH, rồi TienBaoHiemDuyet khi xe làm bảo hiểm', () => {
    expect(insuranceReceivable({ TienThanhToanBH: '300' })).toBe(300);
    expect(
      insuranceReceivable({ XeLamBaoHiem: true, TienBaoHiemDuyet: 200 }),
    ).toBe(200);
    expect(
      insuranceReceivable({ XeLamBaoHiem: false, TienBaoHiemDuyet: 200 }),
    ).toBe(0);
    expect(insuranceReceivable(null)).toBe(0);
  });

  it('phải thu khách hàng: TienThanhToanKH, xe thường thì cả khoản, xe bảo hiểm trừ phần BH', () => {
    expect(customerReceivable({ TienThanhToanKH: 50 }, 1000, 0)).toBe(50);
    expect(customerReceivable({}, 1000, 0)).toBe(1000);
    expect(customerReceivable({ XeLamBaoHiem: true }, 1000, 300)).toBe(700);
    expect(customerReceivable({ XeLamBaoHiem: true }, 100, 300)).toBe(0);
  });
});
