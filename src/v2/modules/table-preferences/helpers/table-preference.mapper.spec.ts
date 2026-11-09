import { toTablePreferenceResponse } from './table-preference.mapper';

describe('table-preference mapper', () => {
  it('maps entity to response with ISO updatedAt and no entity fields', () => {
    const result = toTablePreferenceResponse({
      tableId: 'procurement-requests-garage-table',
      columns: { order: ['a'] },
      views: { activeKey: 'all' },
      updatedAt: new Date('2026-11-09T01:02:03.000Z'),
    } as any);
    expect(result).toEqual({
      tableId: 'procurement-requests-garage-table',
      columns: { order: ['a'] },
      views: { activeKey: 'all' },
      updatedAt: '2026-11-09T01:02:03.000Z',
    });
  });

  it('defaults null json to empty objects', () => {
    const result = toTablePreferenceResponse({
      tableId: 't',
      columns: null,
      views: null,
      updatedAt: new Date(0),
    } as any);
    expect(result.columns).toEqual({});
    expect(result.views).toEqual({});
  });
});
