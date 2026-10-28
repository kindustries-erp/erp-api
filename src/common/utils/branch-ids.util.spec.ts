import { normalizeBranchColumns, readBranchIds } from './branch-ids.util';

describe('normalizeBranchColumns', () => {
  it('takes branch_ids as the source and mirrors its first element', () => {
    expect(
      normalizeBranchColumns({ branchIds: ['a', 'b'], branchId: 'z' }),
    ).toEqual({
      branchIds: ['a', 'b'],
      branchId: 'a',
    });
  });

  it('removes duplicates from branch_ids', () => {
    expect(normalizeBranchColumns({ branchIds: ['a', 'a'] })).toEqual({
      branchIds: ['a'],
      branchId: 'a',
    });
  });

  it('turns a lone branchId into a one-element list', () => {
    expect(normalizeBranchColumns({ branchId: 'a' })).toEqual({
      branchIds: ['a'],
      branchId: 'a',
    });
  });

  it('gives an empty list and null when nothing is set', () => {
    expect(normalizeBranchColumns({})).toEqual({
      branchIds: [],
      branchId: null,
    });
    expect(normalizeBranchColumns({ branchIds: [], branchId: null })).toEqual({
      branchIds: [],
      branchId: null,
    });
  });

  it('keeps an empty branch_ids authoritative over a stale branchId', () => {
    expect(normalizeBranchColumns({ branchIds: [], branchId: 'a' })).toEqual({
      branchIds: [],
      branchId: null,
    });
  });
});

describe('readBranchIds', () => {
  it('reads branch_ids when present', () => {
    expect(readBranchIds({ branchIds: ['a', 'b'], branchId: 'a' })).toEqual([
      'a',
      'b',
    ]);
  });

  it('falls back to a legacy branchId row', () => {
    expect(readBranchIds({ branchIds: [], branchId: 'a' })).toEqual(['a']);
    expect(readBranchIds({ branchId: 'a' })).toEqual(['a']);
  });

  it('returns an empty list when unassigned', () => {
    expect(readBranchIds({ branchIds: [], branchId: null })).toEqual([]);
  });
});
