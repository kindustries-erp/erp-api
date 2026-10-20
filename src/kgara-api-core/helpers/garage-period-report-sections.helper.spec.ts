import { resolvePeriodReportSections } from './garage-period-report-sections.helper';

describe('resolvePeriodReportSections', () => {
  it('không truyền gì thì xuất đủ mục như loại "all"', () => {
    expect([...resolvePeriodReportSections()].sort()).toEqual([
      'cashflow',
      'dashboard',
      'overdue',
      'payables',
      'pnl',
      'receivables',
    ]);
  });

  it('reportType cũ vẫn giữ nguyên ý nghĩa; công nợ tách phải thu và phải trả', () => {
    expect([...resolvePeriodReportSections('business')]).toEqual(['pnl']);
    expect(
      resolvePeriodReportSections('cashflow-debts').has('receivables'),
    ).toBe(true);
    expect(resolvePeriodReportSections('cashflow-debts').has('payables')).toBe(
      true,
    );
  });

  it('mục chọn trực tiếp ưu tiên hơn reportType và ánh xạ đúng khóa', () => {
    const sections = resolvePeriodReportSections('business', [
      'overview',
      'payables',
    ]);
    expect([...sections].sort()).toEqual(['dashboard', 'payables']);
  });

  it('mảng rỗng thì coi như không chọn và dùng reportType', () => {
    expect([...resolvePeriodReportSections('overdue', [])]).toEqual([
      'overdue',
    ]);
  });
});
