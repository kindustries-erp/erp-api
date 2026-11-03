import {
  primaryBranchId,
  resolveBranchIds,
  sameBranchIds,
} from './invoice-branch.helper';

describe('invoice branch helper', () => {
  it('prefers branchIds over branchId and removes duplicates', () => {
    expect(
      resolveBranchIds({ branchIds: ['a', 'a', 'b'], branchId: 'c' }),
    ).toEqual(['a', 'b']);
  });

  it('turns a single branchId into a one-element list, null into empty', () => {
    expect(resolveBranchIds({ branchId: 'a' })).toEqual(['a']);
    expect(resolveBranchIds({ branchId: null })).toEqual([]);
  });

  it('returns undefined when no branch field is sent', () => {
    expect(resolveBranchIds({})).toBeUndefined();
  });

  it('uses the first branch as the primary branch', () => {
    expect(primaryBranchId(['a', 'b'])).toBe('a');
    expect(primaryBranchId([])).toBeNull();
  });

  it('compares branch sets regardless of order', () => {
    expect(sameBranchIds(['a', 'b'], ['b', 'a'])).toBe(true);
    expect(sameBranchIds(['a'], ['a', 'b'])).toBe(false);
  });
});
