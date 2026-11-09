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

  it('trả về bản ghi sau upsert theo (userId, tableId)', async () => {
    const result = await service.upsert('u-1', 't-1', {} as any);

    expect(repo.findOneOrFail).toHaveBeenCalledWith({
      where: { userId: 'u-1', tableId: 't-1' },
    });
    expect(result).toEqual({ tableId: 't-1' });
  });
});
