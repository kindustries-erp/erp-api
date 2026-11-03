import {
  buildReconcileReport,
  DbCaseSnapshot,
  KgaraCaseSnapshot,
} from './kgara-reconcile-report.helper';

const db = (
  soChungTu: string,
  hdPhieuDichVuId: string,
  lineIds: string[],
  tienCoThue = 0,
): DbCaseSnapshot => ({
  soChungTu,
  hdPhieuDichVuId,
  tienCoThue,
  lineIds,
  lineSum: 0,
});

const kg = (
  soChungTu: string,
  hdPhieuDichVuId: string,
  lineIds: string[],
  tienCoThue = 0,
): KgaraCaseSnapshot => ({
  soChungTu,
  hdPhieuDichVuId,
  tienCoThue,
  lineIds,
  lineSum: 0,
});

describe('buildReconcileReport', () => {
  it('finds cases present on one side only', () => {
    const report = buildReconcileReport(
      [db('GR-1', 'h1', []), db('GR-2', 'h2', [])],
      [kg('GR-1', 'h1', []), kg('GR-3', 'h3', [])],
    );
    expect(report.kgaraOnly.map((c) => c.soChungTu)).toEqual(['GR-3']);
    expect(report.dbOnly.map((c) => c.soChungTu)).toEqual(['GR-2']);
  });

  it('counts lines missing in DB and extra in DB per case', () => {
    const report = buildReconcileReport(
      [db('GR-1', 'h1', ['a', 'b', 'x', 'y'])],
      [kg('GR-1', 'h1', ['a', 'b', 'c'])],
    );
    expect(report.lineMismatchCases).toEqual([
      expect.objectContaining({
        soChungTu: 'GR-1',
        kgLines: 3,
        dbLines: 4,
        missingInDb: 1,
        extraInDb: 2,
      }),
    ]);
    expect(report.totals.missingInDb).toBe(1);
    expect(report.totals.extraInDb).toBe(2);
  });

  it('treats a case with zero DB lines and Kgara lines as missing lines', () => {
    const report = buildReconcileReport(
      [db('GR-1', 'h1', [])],
      [kg('GR-1', 'h1', ['a', 'b'])],
    );
    expect(report.lineMismatchCases[0]).toEqual(
      expect.objectContaining({ missingInDb: 2, extraInDb: 0 }),
    );
  });

  it('does not report a case as line mismatch when lines are identical', () => {
    const report = buildReconcileReport(
      [db('GR-1', 'h1', ['a', 'b'], 100)],
      [kg('GR-1', 'h1', ['b', 'a'], 100)],
    );
    expect(report.lineMismatchCases).toEqual([]);
    expect(report.totalMismatchCases).toEqual([]);
  });

  it('reports total mismatch only beyond the 1 money-unit tolerance', () => {
    const report = buildReconcileReport(
      [db('GR-1', 'h1', ['a'], 100), db('GR-2', 'h2', ['b'], 100)],
      [kg('GR-1', 'h1', ['a'], 100.5), kg('GR-2', 'h2', ['b'], 150)],
    );
    expect(report.totalMismatchCases.map((c) => c.soChungTu)).toEqual(['GR-2']);
  });

  it('does not count lines of cases that exist on one side only as mismatches', () => {
    const report = buildReconcileReport([], [kg('GR-9', 'h9', ['a', 'b'])]);
    expect(report.lineMismatchCases).toEqual([]);
    expect(report.totals.kgaraLines).toBe(2);
  });
});
