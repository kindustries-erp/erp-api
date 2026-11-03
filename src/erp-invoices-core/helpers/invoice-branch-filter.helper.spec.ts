import { BadRequestException } from '@nestjs/common';
import {
  branchIdsSqlCondition,
  parseBranchFilter,
} from './invoice-branch-filter.helper';

const ID = '6d37f290-b465-4af1-91b6-265ced4b30bb';

describe('invoice branch filter helper', () => {
  it('maps empty to no filter and "null" to unassigned', () => {
    expect(parseBranchFilter(undefined)).toBeNull();
    expect(parseBranchFilter('')).toBeNull();
    expect(parseBranchFilter('null')).toBe('null');
  });

  it('accepts a uuid and rejects anything else (blocks SQL injection)', () => {
    expect(parseBranchFilter(ID)).toBe(ID);
    expect(() => parseBranchFilter("x' OR '1'='1")).toThrow(
      BadRequestException,
    );
  });

  it('builds a any-match condition on branch_ids, or the unassigned condition', () => {
    expect(branchIdsSqlCondition(ID)).toBe(
      `inv.branch_ids && ARRAY['${ID}']::uuid[]`,
    );
    expect(branchIdsSqlCondition('null')).toBe(
      'cardinality(inv.branch_ids) = 0',
    );
  });
});
