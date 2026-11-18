import { BranchReferenceService } from './branch-reference.service';

describe('BranchReferenceService', () => {
  const dataSource = { query: jest.fn() };
  let service: BranchReferenceService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BranchReferenceService(dataSource as never);
  });

  it('trả rỗng khi không bảng nào tham chiếu', async () => {
    dataSource.query.mockResolvedValue([{ count: '0' }]);
    expect(await service.findReferences('b1')).toEqual([]);
    expect(dataSource.query).toHaveBeenCalledTimes(9);
  });

  it('chỉ trả các bảng còn tham chiếu kèm số dòng, id đi qua tham số', async () => {
    dataSource.query.mockImplementation((sql: string) =>
      Promise.resolve([
        {
          count: sql.includes('erp_bank_transactions')
            ? '2184'
            : sql.includes('debts_garage')
              ? '2'
              : '0',
        },
      ]),
    );
    const refs = await service.findReferences('b1');
    expect(refs).toEqual(
      expect.arrayContaining([
        { table: 'erp_bank_transactions', count: 2184 },
        { table: 'debts_garage', count: 2 },
      ]),
    );
    for (const call of dataSource.query.mock.calls)
      expect(call[1]).toEqual(['b1']);
  });

  it('nhân viên đã xóa mềm không chặn xóa chi nhánh', async () => {
    dataSource.query.mockResolvedValue([{ count: '0' }]);
    await service.findReferences('b1');
    const sql = dataSource.query.mock.calls
      .map((c: unknown[]) => c[0] as string)
      .find((q: string) => q.includes('employees_management'));
    expect(sql).toContain('is_deleted = false');
  });
});
