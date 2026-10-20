import {
  aggregateByBucket,
  bucketKeyOf,
  bucketLabel,
  buildBucketAxis,
  mondayOf,
  periodDayCount,
  resolveBucketUnit,
} from './garage-period-bucket.helper';

describe('garage-period-bucket.helper', () => {
  describe('resolveBucketUnit', () => {
    it.each([
      ['2026-10-12', '2026-10-18', 'day'], // tuần trọn 7 ngày
      ['2026-10-01', '2026-10-27', 'day'], // 27 ngày
      ['2026-10-01', '2026-10-28', 'week'], // 28 ngày
      ['2026-02-01', '2026-02-28', 'week'], // tháng 2 (28 ngày)
      ['2026-09-01', '2026-09-30', 'week'], // tháng 30 ngày
      ['2026-10-01', '2026-10-31', 'week'], // tháng 31 ngày
      ['2026-08-01', '2026-09-29', 'week'], // đúng 60 ngày
      ['2026-08-01', '2026-09-30', 'month'], // 61 ngày
      ['2026-10-01', '2026-12-31', 'month'], // quý 4
      ['2026-01-01', '2026-12-31', 'month'], // năm
    ])('%s → %s là %s', (from, to, unit) => {
      expect(resolveBucketUnit(from, to)).toBe(unit);
    });

    it('thiếu hoặc sai kỳ thì gom theo tháng', () => {
      expect(resolveBucketUnit(undefined, '2026-10-31')).toBe('month');
      expect(resolveBucketUnit('2026-10-01', undefined)).toBe('month');
      expect(resolveBucketUnit('2026-10-31', '2026-10-01')).toBe('month');
    });
  });

  it('periodDayCount tính cả hai đầu và nhận ISO có giờ', () => {
    expect(periodDayCount('2026-10-01', '2026-10-01')).toBe(1);
    expect(periodDayCount('2026-10-01T00:00:00', '2026-10-31T23:59:59')).toBe(
      31,
    );
  });

  it('mondayOf: thứ Hai của tuần, Chủ nhật thuộc tuần trước', () => {
    expect(mondayOf('2026-10-14')).toBe('2026-10-12');
    expect(mondayOf('2026-10-12')).toBe('2026-10-12');
    expect(mondayOf('2026-10-18')).toBe('2026-10-12');
    expect(mondayOf('2026-01-01')).toBe('2025-12-29'); // vắt năm
  });

  it('bucketKeyOf và bucketLabel theo từng đơn vị', () => {
    expect(bucketKeyOf('2026-10-14', 'day')).toBe('2026-10-14');
    expect(bucketKeyOf('2026-10-14', 'week')).toBe('2026-10-12');
    expect(bucketKeyOf('2026-10-14', 'month')).toBe('2026-10-01');
    expect(bucketLabel('2026-10-12', 'day')).toBe('12/10');
    expect(bucketLabel('2026-10-12', 'week')).toBe('Tuần 12/10');
    expect(bucketLabel('2026-10-01', 'month')).toBe('10/2026');
  });

  describe('buildBucketAxis', () => {
    it('theo ngày: đủ từng ngày trong kỳ', () => {
      const axis = buildBucketAxis('2026-10-12', '2026-10-18', 'day');
      expect(axis.map((p) => p.label)).toEqual([
        '12/10',
        '13/10',
        '14/10',
        '15/10',
        '16/10',
        '17/10',
        '18/10',
      ]);
    });

    it('theo tuần: từ thứ Hai của tuần chứa ngày đầu đến tuần chứa ngày cuối', () => {
      const axis = buildBucketAxis('2026-10-01', '2026-10-31', 'week');
      expect(axis.map((p) => p.key)).toEqual([
        '2026-09-28',
        '2026-10-05',
        '2026-10-12',
        '2026-10-19',
        '2026-10-26',
      ]);
    });

    it('theo tháng: quý 4 có 3 mốc, vắt năm đúng', () => {
      expect(
        buildBucketAxis('2026-10-01', '2026-12-31', 'month').map(
          (p) => p.label,
        ),
      ).toEqual(['10/2026', '11/2026', '12/2026']);
      expect(
        buildBucketAxis('2026-11-15', '2027-01-20', 'month').map((p) => p.key),
      ).toEqual(['2026-11-01', '2026-12-01', '2027-01-01']);
    });

    it('kỳ sai thì trục rỗng; trục luôn bị chặn độ dài', () => {
      expect(buildBucketAxis(undefined, '2026-10-01', 'day')).toEqual([]);
      expect(
        buildBucketAxis('1900-01-01', '2026-12-31', 'day').length,
      ).toBeLessThanOrEqual(400);
    });
  });

  describe('aggregateByBucket', () => {
    const axis = buildBucketAxis('2026-10-05', '2026-10-18', 'week');

    it('cộng theo mốc, điền 0 cho mốc trống và bỏ dòng ngoài trục', () => {
      const rows = aggregateByBucket(
        axis,
        'week',
        [
          { date: '2026-10-05', thu: 10, chi: 1 },
          { date: '2026-10-11', thu: 5, chi: 0 },
          { date: '2026-10-14', thu: 7, chi: 2 },
          { date: '2026-11-30', thu: 999, chi: 999 }, // ngoài trục
          { date: 'sai', thu: 999, chi: 999 }, // sai định dạng
        ],
        ['thu', 'chi'] as const,
      );
      expect(rows).toEqual([
        { key: '2026-10-05', label: 'Tuần 05/10', thu: 15, chi: 1 },
        { key: '2026-10-12', label: 'Tuần 12/10', thu: 7, chi: 2 },
      ]);
    });

    it('không có dữ liệu vẫn trả đủ mốc bằng 0', () => {
      const rows = aggregateByBucket(axis, 'week', [], ['thu'] as const);
      expect(rows.map((r) => r.thu)).toEqual([0, 0]);
    });
  });
});
