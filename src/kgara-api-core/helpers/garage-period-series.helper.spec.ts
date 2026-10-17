import type { GaragePeriodReportData } from './garage-period-report.types';
import {
  BUCKET_UNIT_LABEL,
  bucketUnitOf,
  buildCashflowSeries,
} from './garage-period-series.helper';

const week = { from: '2026-10-12', to: '2026-10-18' };
const month = { from: '2026-10-01', to: '2026-10-31' };
const quarter = { from: '2026-10-01', to: '2026-12-31' };

const voucher = (
  transDate: string,
  type: 'RECEIPT' | 'PAYMENT',
  amount: number,
) => ({ transDate, type, amount }) as any;

describe('garage-period-series.helper', () => {
  it('đơn vị: ưu tiên bucketUnit truyền vào, thiếu thì suy từ độ dài kỳ', () => {
    expect(bucketUnitOf({ ...week })).toBe('day');
    expect(bucketUnitOf({ ...month })).toBe('week');
    expect(bucketUnitOf({ ...quarter })).toBe('month');
    expect(bucketUnitOf({ ...week, bucketUnit: 'month' })).toBe('month');
    expect(BUCKET_UNIT_LABEL).toEqual({
      day: 'ngày',
      week: 'tuần',
      month: 'tháng',
    });
  });

  describe('buildCashflowSeries', () => {
    it('kỳ tuần: 7 mốc theo ngày, thu và chi đúng ngày, ngày trống bằng 0', () => {
      const { unit, points } = buildCashflowSeries({
        ...week,
        vouchers: [
          voucher('2026-10-12', 'RECEIPT', 100),
          voucher('2026-10-12', 'PAYMENT', 30),
          voucher('2026-10-14', 'RECEIPT', 50),
        ],
      });
      expect(unit).toBe('day');
      expect(points).toHaveLength(7);
      expect(points[0]).toEqual({
        label: '12/10',
        thu: 100,
        chi: 30,
        planned: 0,
      });
      expect(points[1]).toEqual({ label: '13/10', thu: 0, chi: 0, planned: 0 });
      expect(points[2]).toEqual({
        label: '14/10',
        thu: 50,
        chi: 0,
        planned: 0,
      });
    });

    it('kỳ tháng: gom theo tuần, tổng thu chi giữ nguyên', () => {
      const vouchers = [
        voucher('2026-10-01', 'RECEIPT', 10),
        voucher('2026-10-08', 'RECEIPT', 20),
        voucher('2026-10-30', 'PAYMENT', 5),
      ];
      const { unit, points } = buildCashflowSeries({ ...month, vouchers });
      expect(unit).toBe('week');
      expect(points.map((p) => p.label)).toEqual([
        'Tuần 28/09',
        'Tuần 05/10',
        'Tuần 12/10',
        'Tuần 19/10',
        'Tuần 26/10',
      ]);
      expect(points.reduce((s, p) => s + p.thu, 0)).toBe(30);
      expect(points.reduce((s, p) => s + p.chi, 0)).toBe(5);
    });

    it('kỳ quý: gom theo tháng', () => {
      const { unit, points } = buildCashflowSeries({
        ...quarter,
        vouchers: [voucher('2026-11-20', 'RECEIPT', 7)],
      });
      expect(unit).toBe('month');
      expect(points.map((p) => p.label)).toEqual([
        '10/2026',
        '11/2026',
        '12/2026',
      ]);
      expect(points[1].thu).toBe(7);
    });
  });
});

describe('buildCashflowSeries: dự chi', () => {
  it('phiếu chi Chờ duyệt + Đã duyệt vào dự chi theo ngày; Đã chi (PAID) và phiếu thu không vào dự chi', () => {
    const { points } = buildCashflowSeries({
      from: '2026-10-12',
      to: '2026-10-13',
      asOfDate: new Date(2026, 9, 16),
      pnlMonths: [],
      customerRows: [],
      supplierRows: [],
      openCustomerRows: [],
      openSupplierRows: [],
      vouchers: [
        {
          transDate: '2026-10-12',
          type: 'PAYMENT',
          paymentStatus: 'PENDING',
          amount: 100,
        },
        {
          transDate: '2026-10-12',
          type: 'PAYMENT',
          paymentStatus: 'APPROVED',
          amount: 50,
        },
        {
          transDate: '2026-10-12',
          type: 'PAYMENT',
          paymentStatus: 'PAID',
          amount: 30,
        },
        {
          transDate: '2026-10-13',
          type: 'RECEIPT',
          paymentStatus: null,
          amount: 70,
        },
      ] as GaragePeriodReportData['vouchers'],
    } as GaragePeriodReportData);
    expect(points[0]).toEqual({
      label: '12/10',
      thu: 0,
      chi: 180,
      planned: 150,
    });
    expect(points[1]).toEqual({ label: '13/10', thu: 70, chi: 0, planned: 0 });
  });
});
