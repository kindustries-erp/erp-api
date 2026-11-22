import { TablePreferencesService } from './table-preferences.service';

describe('TablePreferencesService (facade)', () => {
  const row = {
    tableId: 'procurement-requests-garage-table',
    columns: { order: ['a'] },
    views: {},
    updatedAt: new Date('2026-11-09T00:00:00.000Z'),
  };
  let query: any;
  let command: any;
  let service: TablePreferencesService;

  beforeEach(() => {
    query = { listForUser: jest.fn().mockResolvedValue([row]) };
    command = { upsert: jest.fn().mockResolvedValue(row) };
    service = new TablePreferencesService(query, command);
  });

  it('list maps query rows to response items and forwards the prefix', async () => {
    const result = await service.list('u-1', { tableIdPrefix: 'procurement-' });

    expect(query.listForUser).toHaveBeenCalledWith('u-1', 'procurement-');
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

  it('update forwards the patch to the command service and returns a response DTO', async () => {
    const result = await service.update('u-1', 't-1', {
      columns: { order: ['a'] },
    });

    expect(command.upsert).toHaveBeenCalledWith('u-1', 't-1', {
      columns: { order: ['a'] },
    });
    expect(result.updatedAt).toBe('2026-11-09T00:00:00.000Z');
  });
});
