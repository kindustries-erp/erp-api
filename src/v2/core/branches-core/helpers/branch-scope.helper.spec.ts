import type { SelectQueryBuilder } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import {
  applyBranchScope,
  assertErpBranchExists,
  branchWhere,
} from './branch-scope.helper';

describe('applyBranchScope', () => {
  const makeQb = () => {
    const qb = {
      andWhere: jest.fn(),
    } as unknown as SelectQueryBuilder<object> & {
      andWhere: jest.Mock;
    };
    qb.andWhere.mockReturnValue(qb);
    return qb;
  };

  it('không thêm điều kiện khi không có branchId', () => {
    const qb = makeQb();
    expect(applyBranchScope(qb, 'c')).toBe(qb);
    applyBranchScope(qb, 'c', null);
    expect(qb.andWhere).not.toHaveBeenCalled();
  });

  it('lọc alias.branch_id bằng tham số bind', () => {
    const qb = makeQb();
    applyBranchScope(qb, 'c', 'b-1');
    expect(qb.andWhere).toHaveBeenCalledWith('c.branch_id = :scopeBranchId', {
      scopeBranchId: 'b-1',
    });
    applyBranchScope(qb, 'd', 'b-2', 'debtBranch');
    expect(qb.andWhere).toHaveBeenLastCalledWith('d.branch_id = :debtBranch', {
      debtBranch: 'b-2',
    });
  });
});

describe('branchWhere', () => {
  it('trả điều kiện khi có chi nhánh, rỗng khi không', () => {
    expect(branchWhere('b-1')).toEqual({ branchId: 'b-1' });
    expect(branchWhere(undefined)).toEqual({});
  });
});

describe('assertErpBranchExists', () => {
  it('không có branchId thì không truy vấn', async () => {
    const m = { query: jest.fn() };
    await assertErpBranchExists(m, undefined);
    expect(m.query).not.toHaveBeenCalled();
  });

  it('chi nhánh có thì qua, không có thì 400', async () => {
    const m = { query: jest.fn().mockResolvedValueOnce([{ '?column?': 1 }]) };
    await expect(assertErpBranchExists(m, 'b1')).resolves.toBeUndefined();
    expect(m.query.mock.calls[0][1]).toEqual(['b1']);
    m.query.mockResolvedValueOnce([]);
    await expect(assertErpBranchExists(m, 'b-x')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
