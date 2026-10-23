import {
  applyBranchIdsFilter,
  resolveFilterBranchIds,
} from './branch-ids-filter.util';

const makeQb = () => {
  const calls: { sql: string; params?: any }[] = [];
  const qb: any = {
    andWhere: jest.fn((sql: string, params?: any) => {
      calls.push({ sql, params });
      return qb;
    }),
  };
  return { qb, calls };
};

describe('applyBranchIdsFilter', () => {
  it('lọc overlap khi chỉ chọn chi nhánh', () => {
    const { qb, calls } = makeQb();
    applyBranchIdsFilter(qb, ['b1', 'b2'], 'ids');
    expect(calls[0].sql).toContain('txn.branchIds && ARRAY[:...ids]::uuid[]');
    expect(calls[0].params).toEqual({ ids: ['b1', 'b2'] });
  });

  it('chỉ __BLANK__ → lọc mảng rỗng', () => {
    const { qb, calls } = makeQb();
    applyBranchIdsFilter(qb, ['__BLANK__'], 'ids');
    expect(calls[0].sql).toBe('cardinality(txn.branchIds) = 0');
  });

  it('chi nhánh + __BLANK__ → gồm cả giao dịch chưa gán', () => {
    const { qb, calls } = makeQb();
    applyBranchIdsFilter(qb, ['b1', '__BLANK__'], 'ids', 'txn.branch_ids');
    expect(calls[0].sql).toContain('txn.branch_ids && ARRAY[:...ids]::uuid[]');
    expect(calls[0].sql).toContain('cardinality(txn.branch_ids) = 0');
    expect(calls[0].params).toEqual({ ids: ['b1'] });
  });
});

describe('resolveFilterBranchIds', () => {
  it('ưu tiên branchIds, rơi về branchId cũ, rỗng nếu không có', () => {
    expect(
      resolveFilterBranchIds({ branchIds: ['a', 'b'], branchId: 'x' }),
    ).toEqual(['a', 'b']);
    expect(resolveFilterBranchIds({ branchId: 'x' })).toEqual(['x']);
    expect(resolveFilterBranchIds({})).toEqual([]);
  });
});
