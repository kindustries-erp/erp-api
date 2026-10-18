import type { GarageDebtExportRow } from './garage-debts-export.helper';
import { summarizeOverdue } from './garage-overdue-warning.helper';

const row = (
  patch: Partial<GarageDebtExportRow> = {},
): GarageDebtExportRow => ({
  licensePlate: '30A-111.11',
  partnerCode: 'KH01',
  partnerName: 'Công ty A',
  caseCount: 1,
  totalAmount: 0,
  paidAmount: 0,
  balanceAmount: 0,
  aging0_30: 0,
  aging31_60: 0,
  aging61_90: 0,
  agingOver90: 0,
  maxAgingDays: 0,
  ...patch,
});

describe('garage-overdue-warning.helper', () => {
  it('không có nợ: mức OK, mọi số bằng 0', () => {
    const s = summarizeOverdue('receivable', []);
    expect(s).toMatchObject({
      level: 'OK',
      partnerCount: 0,
      totalBalance: 0,
      overdueAmount: 0,
      overdueRate: 0,
    });
  });

  it('chỉ nợ trong 30 ngày: vẫn OK, bỏ qua dòng không còn nợ', () => {
    const s = summarizeOverdue('receivable', [
      row({ aging0_30: 500 }),
      row({ partnerCode: 'KH02' }),
    ]);
    expect(s.level).toBe('OK');
    expect(s.partnerCount).toBe(1);
    expect(s.overdueRate).toBe(0);
  });

  it('có nợ 31-60 ngày: mức CHÚ Ý, tỷ lệ quá hạn trên tổng nợ', () => {
    const s = summarizeOverdue('payable', [
      row({ aging0_30: 100, aging31_60: 300 }),
    ]);
    expect(s.level).toBe('WATCH');
    expect(s.overdueAmount).toBe(300);
    expect(s.overdueRate).toBeCloseTo(0.75, 6);
  });

  it('có nợ 61-90 ngày: mức TRUNG BÌNH', () => {
    const s = summarizeOverdue('receivable', [row({ aging61_90: 200 })]);
    expect(s.level).toBe('MEDIUM');
    expect(s.b61_90).toBe(200);
  });

  it('có nợ trên 90 ngày: mức CAO, tổng và đối tượng lớn nhất', () => {
    const s = summarizeOverdue('receivable', [
      row({ partnerName: 'Nhỏ', licensePlate: '', agingOver90: 1000 }),
      row({
        partnerName: 'Lớn',
        licensePlate: '51K-222.22',
        agingOver90: 5000000,
        aging0_30: 1000,
      }),
      row({ aging61_90: 700 }),
    ]);
    expect(s.level).toBe('HIGH');
    expect(s.countOver90).toBe(2);
    expect(s.over90).toBe(5001000);
    expect(s.topOver90).toEqual({
      label: '51K-222.22 - Lớn',
      amount: 5000000,
    });
  });
});
