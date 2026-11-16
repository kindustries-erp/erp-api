import {
  buildAgingComparison,
  calculateForecast,
  getHorizonCaseSqlCondition,
  getHorizonTitle,
} from './garage-debts-horizon.helper';

const t = (a: number, b: number, c: number, d: number) => ({
  d0_30: a,
  d31_60: b,
  d61_90: c,
  over90: d,
});

describe('garage-debts-horizon.helper', () => {
  it('điều kiện mốc dùng đúng bí danh và ngưỡng ngày', () => {
    expect(getHorizonCaseSqlCondition('nextWeekDue', 'c')).toContain(
      'c.ngay_hoan_thanh_cong_viec',
    );
    expect(getHorizonCaseSqlCondition('overdue30To90', 'c')).toContain('> 30');
    expect(getHorizonCaseSqlCondition('overdue30To90', 'c')).toContain('<= 90');
    expect(getHorizonCaseSqlCondition('khong-ton-tai', 'c')).toBe('1=1');
  });

  it('nhãn mốc, mặc định khi lạ', () => {
    expect(getHorizonTitle('overdue30To90')).toBe('Quá hạn 31-90 ngày');
    expect(getHorizonTitle('x')).toBe('Mốc thời gian');
  });

  it('so sánh tuổi nợ: net = phải thu - phải trả theo từng mốc', () => {
    const rows = buildAgingComparison(t(100, 50, 20, 10), t(30, 60, 0, 5));
    expect(rows.map((r) => [r.bracket, r.netAmount])).toEqual([
      ['0_30', 70],
      ['31_60', -10],
      ['61_90', 20],
      ['over_90', 5],
    ]);
  });

  it('dự báo IFRS 9 làm tròn theo hệ số của V1', () => {
    const f = calculateForecast(
      t(1000, 1000, 1000, 1000),
      t(1000, 1000, 1000, 1000),
      { receivable: 10, payable: 4 },
      { receivable: 20, payable: 5 },
    );
    expect(f.next7Days).toEqual({ receivable: 10, payable: 4, net: 6 });
    expect(f.expectedCashflow.receivable).toBe(1850);
    expect(f.expectedCashflow.payable).toBe(3000);
    expect(f.defaultRiskProvision).toEqual({
      receivableRisk: 2150,
      payableRisk: 1000,
      netRisk: 1150,
    });
  });
});
