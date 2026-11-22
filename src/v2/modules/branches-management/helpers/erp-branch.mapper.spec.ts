import { BranchManagement } from '../entities/branch-management.entity';
import { toErpBranchResponse } from './erp-branch.mapper';

describe('ErpBranch mapper', () => {
  const createdAt = new Date('2026-01-01T00:00:00.000Z');
  const entity = {
    id: 'id-1',
    extraData: {},
    code: 'sample',
    name: 'sample',
    address: null,
    isActive: false,
    createdAt,
    updatedAt: createdAt,
  } as BranchManagement;

  it('preserves the exact JSON shape including a null address and inactive state', () => {
    expect(toErpBranchResponse(entity)).toEqual({
      id: 'id-1',
      extraData: {},
      code: 'sample',
      name: 'sample',
      address: null,
      isActive: false,
      createdAt,
      updatedAt: createdAt,
    });
  });

  it('does not add keys or convert Date instances before JSON serialization', () => {
    expect(JSON.stringify(toErpBranchResponse(entity))).toBe(
      JSON.stringify(entity),
    );
  });
});
