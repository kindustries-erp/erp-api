import { TablePreferenceCommandService } from './table-preference-command.service';

describe('TablePreferenceCommandService', () => {
  let insertQb: any;
  let repo: any;
  let service: TablePreferenceCommandService;

  beforeEach(() => {
    insertQb = {
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orUpdate: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({}),
    };
    repo = {
      createQueryBuilder: jest.fn().mockReturnValue(insertQb),
      findOneOrFail: jest.fn().mockResolvedValue({ tableId: 't-1' }),
    };
    service = new TablePreferenceCommandService(repo);
  });

  it('chỉ ghi đè columns khi có gửi columns (views giữ nguyên)', async () => {
    await service.upsert('u-1', 't-1', {
      columns: { order: ['a', 'b'] },
    } as any);

    expect(insertQb.orUpdate).toHaveBeenCalledWith(
      ['updated_at', 'columns'],
      ['user_id', 'table_id'],
    );
    expect(insertQb.values).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u-1',
        tableId: 't-1',
        columns: { order: ['a', 'b'] },
        views: {},
      }),
    );
  });

  it('không gửi trường nào thì chỉ cập nhật updated_at', async () => {
    await service.upsert('u-1', 't-1', {} as any);

    expect(insertQb.orUpdate).toHaveBeenCalledWith(
      ['updated_at'],
      ['user_id', 'table_id'],
    );
  });

  it('lọc bỏ khóa không khai báo khi ghi views', async () => {
    await service.upsert('u-1', 't-1', {
      views: { activeKey: 'all', injected: 'x' } as any,
    });

    const values = insertQb.values.mock.calls[0][0];
    expect(values.views).toEqual({ activeKey: 'all' });
    expect(insertQb.orUpdate).toHaveBeenCalledWith(
      ['updated_at', 'views'],
      ['user_id', 'table_id'],
    );
  });

  it('ghi filterKey của custom view và giữ nguyên các khóa khác', async () => {
    await service.upsert('u-1', 't-1', {
      views: {
        customViews: [
          {
            key: 'custom_1',
            label: 'Chờ duyệt',
            baseKey: 'all',
            visibility: { poNumber: true },
            order: ['poNumber'],
            filterKey: 'pending',
          },
        ],
      } as any,
    });

    const values = insertQb.values.mock.calls[0][0];
    expect(values.views.customViews).toEqual([
      {
        key: 'custom_1',
        label: 'Chờ duyệt',
        baseKey: 'all',
        visibility: { poNumber: true },
        order: ['poNumber'],
        filterKey: 'pending',
      },
    ]);
  });

  it('view cũ không có filterKey thì không sinh khóa filterKey', async () => {
    await service.upsert('u-1', 't-1', {
      views: {
        customViews: [
          {
            key: 'custom_2',
            label: 'Cũ',
            baseKey: 'all',
            visibility: {},
            order: [],
          },
        ],
      } as any,
    });

    const values = insertQb.values.mock.calls[0][0];
    expect(values.views.customViews[0]).not.toHaveProperty('filterKey');
  });

  it('ghi customFilters với query đã lọc khóa lạ', async () => {
    await service.upsert('u-1', 't-1', {
      views: {
        customFilters: [
          {
            key: 'cf_1',
            label: 'Chờ duyệt có lọc cột',
            groupKey: 'pending',
            query: { sort: 'poNumber:asc', cf: 'poNumber=PO1', evil: 'x' },
          },
        ],
      } as any,
    });

    const values = insertQb.values.mock.calls[0][0];
    expect(values.views.customFilters).toEqual([
      {
        key: 'cf_1',
        label: 'Chờ duyệt có lọc cột',
        groupKey: 'pending',
        query: { sort: 'poNumber:asc', cf: 'poNumber=PO1' },
      },
    ]);
  });

  it('customFilters không có groupKey thì không sinh khóa groupKey', async () => {
    await service.upsert('u-1', 't-1', {
      views: {
        customFilters: [
          { key: 'cf_2', label: 'Tìm nhanh', query: { q: 'abc' } },
        ],
      } as any,
    });

    const values = insertQb.values.mock.calls[0][0];
    expect(values.views.customFilters[0]).not.toHaveProperty('groupKey');
    expect(values.views.customFilters[0].query).toEqual({ q: 'abc' });
  });

  it('không gửi customFilters thì không ghi khóa customFilters (dữ liệu cũ)', async () => {
    await service.upsert('u-1', 't-1', {
      views: { activeKey: 'all' } as any,
    });

    const values = insertQb.values.mock.calls[0][0];
    expect(values.views).toEqual({ activeKey: 'all' });
    expect(values.views).not.toHaveProperty('customFilters');
  });

  it('trả về bản ghi sau upsert theo (userId, tableId)', async () => {
    const result = await service.upsert('u-1', 't-1', {} as any);

    expect(repo.findOneOrFail).toHaveBeenCalledWith({
      where: { userId: 'u-1', tableId: 't-1' },
    });
    expect(result).toEqual({ tableId: 't-1' });
  });
});
