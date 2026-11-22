import {
  getHorizonCaseSqlCondition,
  getHorizonPayableSqlCondition,
  getHorizonTitle,
} from './garage-debts-horizon.helper';

describe('garage-debts-horizon.helper (v1)', () => {
  it('các mốc tuổi nợ không chồng lấn: ≤7, 8–30, 31–60, 61–90, >90', () => {
    const ageOf = (h: string) => getHorizonCaseSqlCondition(h, 'c');
    expect(ageOf('nextWeekDue')).toContain('<= 7');
    expect(ageOf('nextMonthDue')).toBe(
      `(CURRENT_DATE - DATE(c.ngay_hoan_thanh_cong_viec)) > 7 AND (CURRENT_DATE - DATE(c.ngay_hoan_thanh_cong_viec)) <= 30`,
    );
    expect(ageOf('overdue31To60')).toContain('BETWEEN 31 AND 60');
    expect(ageOf('overdue61To90')).toContain('BETWEEN 61 AND 90');
    expect(ageOf('overdue30To90')).toContain('> 30');
    expect(ageOf('criticalOverdue90Plus')).toContain('> 90');
  });

  it('phải thu và phải trả dùng cùng khoảng tuổi nợ', () => {
    for (const h of ['nextMonthDue', 'overdue31To60', 'overdue61To90']) {
      const c = getHorizonCaseSqlCondition(h, 'c');
      const p = getHorizonPayableSqlCondition(h, 'p');
      // Điều kiện có cùng ngưỡng số, chỉ khác alias
      expect(c.replace(/c\.ngay_hoan_thanh_cong_viec/g, 'X')).toBe(
        p.replace(
          /COALESCE\(p\.period_to, p\.period_from, p\.created_at\)/g,
          'X',
        ),
      );
    }
  });

  it('nhãn mốc mới đúng và giữ nhãn key cũ', () => {
    expect(getHorizonTitle('nextMonthDue')).toBe('Trong hạn chuẩn (8–30 ngày)');
    expect(getHorizonTitle('overdue31To60')).toBe('Quá hạn 31-60 ngày');
    expect(getHorizonTitle('overdue61To90')).toBe('Quá hạn 61-90 ngày');
    expect(getHorizonTitle('overdue30To90')).toBe('Quá hạn 31-90 ngày');
  });

  it('mốc không phải tuổi nợ không bị ảnh hưởng', () => {
    expect(getHorizonCaseSqlCondition('expectedCashflow', 'c')).toBe('1=1');
  });
});
