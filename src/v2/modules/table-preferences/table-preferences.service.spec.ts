import { TablePreferencesService } from './table-preferences.service';

describe('TablePreferencesService (facade)', () => {
  const row = {
    tableId: 'procurement-requests-garage-table',
    columns: { order: ['a'] },
    views: {},
    updatedAt: new Date('2026-11-09T00:00:00.000Z'),
  };
  let core: any;
  let service: TablePreferencesService;

  beforeEach(() => {
    core = {
      listForUser: jest.fn().mockResolvedValue([row]),
      upsertForUser: jest.fn().mockResolvedValue(row),
    };
    service = new TablePreferencesService(core);
  });

  it('list maps core rows to response items and forwards the prefix', async () => {
    const result = await service.list('u-1', { tableIdPrefix: 'procurement-' });

    expect(core.listForUser).toHaveBeenCalledWith('u-1', 'procurement-');
    expect(result).toEqual({
      items: [
        {
          tableId: 'procurement-requests-garage-table',
          columns: { order: ['a'] },
          views: {},
          updatedAt: '2026-11-09T00:00:00.000Z',
        },
      ],
    });
  });

  it('update forwards the patch to core and returns a response DTO', async () => {
    const result = await service.update('u-1', 't-1', {
      columns: { order: ['a'] },
    });

    expect(core.upsertForUser).toHaveBeenCalledWith('u-1', 't-1', {
      columns: { order: ['a'] },
    });
    expect(result.updatedAt).toBe('2026-11-09T00:00:00.000Z');
  });
});
