import type { GarageDebtExportRow } from './garage-debts-export.helper';
import {
  buildOverdueCards,
  formatVnd,
  summarizeOverdue,
} from './garage-overdue-warning.helper';

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
  it('formatVnd dùng dấu chấm ngăn cách hàng nghìn', () => {
    expect(formatVnd(85000000)).toBe('85.000.000 đ');
    expect(formatVnd(0)).toBe('0 đ');
  });

  it('không có nợ: mức OK, cả 4 thẻ đều xám nhạt', () => {
    const s = summarizeOverdue('receivable', []);
    expect(s).toMatchObject({ level: 'OK', partnerCount: 0, totalBalance: 0 });

    const cards = buildOverdueCards(s);
    expect(cards).toHaveLength(4);
    expect(cards[0]).toMatchObject({
      label: 'PHẢI THU: MỨC CẢNH BÁO',
      value: 'ỔN',
      note: 'Không có nợ quá hạn trên 30 ngày',
    });
    expect(cards.slice(1).map((c) => [c.value, c.note, c.fill])).toEqual([
      [0, 'Không có', 'FFF1F5F9'],
      [0, 'Không có', 'FFF1F5F9'],
      [0, 'Không có', 'FFF1F5F9'],
    ]);
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

  it('có nợ 31-60 ngày: mức CHÚ Ý, thẻ 31-60 màu vàng, các thẻ khác xám', () => {
    const s = summarizeOverdue('payable', [
      row({ aging0_30: 100, aging31_60: 300 }),
    ]);
    expect(s.level).toBe('WATCH');
    expect(s.overdueRate).toBeCloseTo(0.75, 6);

    const [level, over90, b6190, b3160] = buildOverdueCards(s);
    expect(level).toMatchObject({ value: 'CHÚ Ý', fill: 'FFFEF3C7' });
    expect(level.note).toBe('Quá hạn >30 ngày: 75,0% tổng nợ (300 đ)');
    expect(over90.fill).toBe('FFF1F5F9');
    expect(b6190.fill).toBe('FFF1F5F9');
    expect(b3160).toMatchObject({
      label: 'PHẢI TRẢ: NỢ 31-60 NGÀY',
      value: 300,
      note: '1 đối tượng',
      fill: 'FFFEF3C7',
    });
  });

  it('có nợ 61-90 ngày: mức TRUNG BÌNH, thẻ 61-90 màu cam', () => {
    const s = summarizeOverdue('receivable', [row({ aging61_90: 200 })]);
    expect(s.level).toBe('MEDIUM');
    const [level, , b6190] = buildOverdueCards(s);
    expect(level.value).toBe('TRUNG BÌNH');
    expect(b6190).toMatchObject({ value: 200, fill: 'FFFFEDD5' });
  });

  it('có nợ trên 90 ngày: mức CAO, thẻ >90 nêu số đối tượng, tổng và đối tượng lớn nhất', () => {
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

    const [level, over90] = buildOverdueCards(s);
    expect(level).toMatchObject({
      value: 'CAO',
      fill: 'FFFEE2E2',
      font: 'FFBE123C',
    });
    expect(over90).toMatchObject({
      label: 'PHẢI THU: NỢ TRÊN 90 NGÀY',
      value: 5001000,
      fill: 'FFFEE2E2',
    });
    expect(over90.note).toBe(
      '2 đối tượng; lớn nhất: 51K-222.22 - Lớn (5.000.000 đ)',
    );
  });
});
