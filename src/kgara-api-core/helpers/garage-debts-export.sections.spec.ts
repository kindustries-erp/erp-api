import { convertReceivablesBreakdownToExportSections } from './garage-debts-export.helper';

const breakdown = (cases: any[]) => ({
  summary: { totalBilled: 10000000 },
  categorized: {
    enterprise: {
      all: [{ title: 'Công ty A', payerType: 'KH', cases }],
      totals: { billed: 10000000, paid: 0, remaining: 10000000, cost: 6000000 },
    },
  },
});

describe('convertReceivablesBreakdownToExportSections: chi phí hồ sơ', () => {
  it('chi phí từng hồ sơ và tổng chi phí nhóm lấy từ breakdown', () => {
    const [section] = convertReceivablesBreakdownToExportSections(
      breakdown([
        {
          id: 'c1',
          amount: 4000000,
          paid: 0,
          remaining: 4000000,
          cost: 2500000,
        },
        {
          id: 'c2',
          amount: 6000000,
          paid: 0,
          remaining: 6000000,
          cost: 3500000,
        },
      ]),
    );
    expect(section.key).toBe('enterprise');
    expect(section.cases.map((c) => c.costAmount)).toEqual([2500000, 3500000]);
    expect(section.costAmount).toBe(6000000);
    expect(section.totalAmount).toBe(10000000);
  });

  it('thiếu chi phí thì coi là 0 và tổng nhóm cộng theo hồ sơ', () => {
    const data: any = breakdown([
      { id: 'c1', amount: 4000000, paid: 0, remaining: 4000000 },
    ]);
    delete data.categorized.enterprise.totals.cost;
    const [section] = convertReceivablesBreakdownToExportSections(data);
    expect(section.cases[0].costAmount).toBe(0);
    expect(section.costAmount).toBe(0);
  });
});
