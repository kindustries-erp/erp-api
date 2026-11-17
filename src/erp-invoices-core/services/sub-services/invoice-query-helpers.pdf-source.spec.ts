import { _applyColumnFilters } from './invoice-query-helpers';

function fakeQb() {
  const calls: Array<{ sql: string; params?: Record<string, unknown> }> = [];
  const qb = {
    andWhere(sql: string, params?: Record<string, unknown>) {
      calls.push({ sql, params });
      return qb;
    },
  };
  return { qb, calls };
}

describe('_applyColumnFilters: pdfSource', () => {
  it('lọc theo tập giá trị nguồn PDF gốc', () => {
    const { qb, calls } = fakeQb();
    _applyColumnFilters(qb, {
      pdfSource: ['manual_upload', 'provider_original'],
    });
    expect(calls).toEqual([
      {
        sql: 'inv.pdf_source IN (:...pdfSourceVals)',
        params: { pdfSourceVals: ['manual_upload', 'provider_original'] },
      },
    ]);
  });

  it('__BLANK__ một mình lọc pdf_source IS NULL', () => {
    const { qb, calls } = fakeQb();
    _applyColumnFilters(qb, { pdfSource: ['__BLANK__'] });
    expect(calls).toEqual([
      { sql: 'inv.pdf_source IS NULL', params: undefined },
    ]);
  });

  it('__BLANK__ kèm giá trị thì gồm cả NULL', () => {
    const { qb, calls } = fakeQb();
    _applyColumnFilters(qb, { pdfSource: ['failed', '__BLANK__'] });
    expect(calls[0].sql).toContain('inv.pdf_source IS NULL');
    expect(calls[0].params).toEqual({ pdfSourceVals: ['failed'] });
  });

  it('mảng rỗng không thêm điều kiện', () => {
    const { qb, calls } = fakeQb();
    _applyColumnFilters(qb, { pdfSource: [] });
    expect(calls).toEqual([]);
  });
});
